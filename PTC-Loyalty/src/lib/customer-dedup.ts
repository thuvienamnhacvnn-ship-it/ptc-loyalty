import { db } from "@/lib/db";

/**
 * Check whether a phone or email is already used by another customer in the same
 * business (tenant-scoped). Returns which field conflicts, or null if clear.
 * Pass `excludeId` when editing an existing customer so it doesn't match itself.
 */
export async function findCustomerConflict(
  businessId: string,
  opts: { phone?: string | null; email?: string | null; excludeId?: string },
): Promise<"phone" | "email" | null> {
  const phone = opts.phone?.trim();
  const email = opts.email?.trim().toLowerCase();
  const notSelf = opts.excludeId ? { not: opts.excludeId } : undefined;

  if (phone) {
    const dup = await db.customerProfile.findFirst({
      where: { businessId, phone, id: notSelf },
      select: { id: true },
    });
    if (dup) return "phone";
  }
  if (email) {
    const dup = await db.customerProfile.findFirst({
      where: { businessId, email: { equals: email, mode: "insensitive" }, id: notSelf },
      select: { id: true },
    });
    if (dup) return "email";
  }
  return null;
}
