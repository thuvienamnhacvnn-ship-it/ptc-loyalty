import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyAccessToken } from "@/lib/pos/token";
import { isBusinessStaff } from "@/lib/rbac";
import type { BusinessContext } from "@/lib/tenant";
import type { PosBranch, PosBusiness, PosRole } from "@/lib/pos/contract";
import { POS_ERROR_MESSAGES } from "@/lib/pos/contract";

// ─────────────────────────────────────────────────────────────────────────────
// Bearer-token business context for the POS API. This is the tenant-isolation
// choke-point for the desktop client, mirroring src/lib/tenant.ts but driven by
// an Authorization header instead of a session cookie.
//
// CRITICAL: businessId is ALWAYS derived from the caller's StaffProfile in the
// DB — never taken from the request. The desktop client cannot spoof a tenant.
// ─────────────────────────────────────────────────────────────────────────────

export interface PosContext extends BusinessContext {
  role: PosRole; // narrowed: staff/manager/owner only
  business: PosBusiness;
  branches: PosBranch[];
  fixedBranchId: string | null;
}

export type PosAuthResult =
  | { ok: true; ctx: PosContext }
  | { ok: false; status: number; error: string };

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

/**
 * Authenticate a POS request. Resolves the user from the access token, then the
 * single active StaffProfile (business membership) that grants POS access.
 *
 * The optional `requestedBranchId` (from body or the `X-Branch-Id` header) is
 * validated against the business's branches. If the staff member is pinned to a
 * branch, that branch always wins.
 */
export async function requirePosContext(
  req: NextRequest,
  requestedBranchId?: string | null,
): Promise<PosAuthResult> {
  const token = bearer(req);
  if (!token) return { ok: false, status: 401, error: "unauthorized" };

  const verified = verifyAccessToken(token);
  if (!verified.ok) return { ok: false, status: 401, error: "unauthorized" };

  const user = await db.user.findUnique({ where: { id: verified.userId } });
  if (!user || !user.isActive) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  // Super admins have no StaffProfile and must never reach the POS API.
  const staff = await db.staffProfile.findFirst({
    where: { userId: user.id, isActive: true },
    include: { business: true, branch: true },
    orderBy: { createdAt: "asc" },
  });
  if (!staff) return { ok: false, status: 403, error: "no_business" };
  if (!isBusinessStaff(staff.role)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (staff.business.status === "SUSPENDED") {
    return { ok: false, status: 403, error: "forbidden" };
  }

  const allBranches = await db.branch.findMany({
    where: { businessId: staff.businessId, isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  // Resolve the operating branch. Pinned staff cannot override.
  let operatingBranchId: string | null = staff.branchId;
  if (!operatingBranchId && requestedBranchId) {
    const valid = allBranches.some((b) => b.id === requestedBranchId);
    if (!valid) return { ok: false, status: 400, error: "invalid_branch" };
    operatingBranchId = requestedBranchId;
  }

  const headerBranch = req.headers.get("x-branch-id");
  if (!staff.branchId && !operatingBranchId && headerBranch) {
    const valid = allBranches.some((b) => b.id === headerBranch);
    if (valid) operatingBranchId = headerBranch;
  }

  const ctx: PosContext = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
    },
    businessId: staff.businessId,
    role: staff.role as PosRole,
    branchId: operatingBranchId,
    staffProfileId: staff.id,
    business: {
      id: staff.business.id,
      name: staff.business.name,
      slug: staff.business.slug,
      currency: staff.business.currency,
    },
    branches: allBranches,
    fixedBranchId: staff.branchId,
  };
  return { ok: true, ctx };
}

/** Build the standard JSON error body for a POS error code. */
export function posError(error: string): { error: string; message: string } {
  return { error, message: POS_ERROR_MESSAGES[error] ?? POS_ERROR_MESSAGES.server_error };
}
