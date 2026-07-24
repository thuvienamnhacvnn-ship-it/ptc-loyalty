import { db } from "@/lib/db";

export interface CustomerConflict {
  /** Which field collided. */
  field: "phone" | "email";
  /** The existing customer that already uses this phone/email (same business). */
  customerId: string;
  /** Their display name, so callers can tell the user exactly who holds it. */
  name: string;
}

function displayName(c: { firstName: string; lastName: string | null }): string {
  return `${c.firstName} ${c.lastName ?? ""}`.trim();
}

/**
 * Check whether a phone or email is already used by another customer in the same
 * business (tenant-scoped). Returns the conflicting field AND the existing
 * customer (id + name), or null if clear. Pass `excludeId` when editing an
 * existing customer so it doesn't match itself.
 *
 * Note: this only matches LIVE rows — deleting a customer hard-deletes the row,
 * so a deleted customer's phone/email is immediately reusable.
 */
export async function findCustomerConflict(
  businessId: string,
  opts: { phone?: string | null; email?: string | null; excludeId?: string },
): Promise<CustomerConflict | null> {
  const phone = opts.phone?.trim();
  const email = opts.email?.trim().toLowerCase();
  const notSelf = opts.excludeId ? { not: opts.excludeId } : undefined;

  if (phone) {
    const dup = await db.customerProfile.findFirst({
      where: { businessId, phone, id: notSelf },
      select: { id: true, firstName: true, lastName: true },
    });
    if (dup) return { field: "phone", customerId: dup.id, name: displayName(dup) };
  }
  if (email) {
    const dup = await db.customerProfile.findFirst({
      where: { businessId, email: { equals: email, mode: "insensitive" }, id: notSelf },
      select: { id: true, firstName: true, lastName: true },
    });
    if (dup) return { field: "email", customerId: dup.id, name: displayName(dup) };
  }
  return null;
}
