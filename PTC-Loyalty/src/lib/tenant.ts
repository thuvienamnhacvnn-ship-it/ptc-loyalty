import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isPlatformAdmin, homeForRole } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: UserRole;
}

/** Returns the signed-in user or null. Never throws. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    image: session.user.image,
    role: session.user.role,
  };
}

/** Requires a signed-in user; redirects to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Requires SUPER_ADMIN; redirects otherwise. */
export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isPlatformAdmin(user.role)) redirect("/login");
  return user;
}

export interface BusinessContext {
  user: SessionUser;
  businessId: string;
  role: UserRole; // effective role inside this business
  branchId: string | null;
  staffProfileId: string;
}

/**
 * Resolves the business a staff/owner/manager belongs to and enforces access.
 * This is the single choke-point for tenant isolation on the business side:
 * every dashboard query must scope by the returned `businessId`.
 */
export async function requireBusinessContext(): Promise<BusinessContext> {
  const user = await requireUser();

  const staff = await db.staffProfile.findFirst({
    where: { userId: user.id, isActive: true },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  });

  if (!staff || staff.business.status === "SUSPENDED") {
    // No active business membership -> send the user to their proper home
    // (super admin -> /admin, customer -> /member) instead of a dead-end.
    const home = homeForRole(user.role);
    redirect(home === "/dashboard" ? "/login" : home);
  }

  return {
    user,
    businessId: staff.businessId,
    role: staff.role,
    branchId: staff.branchId,
    staffProfileId: staff.id,
  };
}

/**
 * Guard used inside data access to guarantee a record belongs to the caller's
 * tenant. Throws (500) rather than leaking cross-tenant data.
 */
export function assertSameTenant(
  recordBusinessId: string,
  contextBusinessId: string,
): void {
  if (recordBusinessId !== contextBusinessId) {
    throw new Error("Cross-tenant access denied");
  }
}

/** Resolve the customer profile for a signed-in customer within a business. */
export async function getCustomerContext(businessSlug?: string) {
  const user = await requireUser();
  const where = businessSlug
    ? { userId: user.id, business: { slug: businessSlug } }
    : { userId: user.id };
  const profile = await db.customerProfile.findFirst({
    where,
    include: { business: true, membership: { include: { tier: true } } },
    orderBy: { createdAt: "asc" },
  });
  return { user, profile };
}
