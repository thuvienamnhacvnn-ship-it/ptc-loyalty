import type { UserRole } from "@prisma/client";

// Ordered from most to least privileged for hierarchy checks.
export const ROLE_RANK: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  BUSINESS_OWNER: 80,
  BUSINESS_MANAGER: 60,
  STAFF: 40,
  CUSTOMER: 20,
};

export function hasAtLeast(role: UserRole, min: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function isPlatformAdmin(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

export function isBusinessStaff(role: UserRole): boolean {
  return (
    role === "BUSINESS_OWNER" ||
    role === "BUSINESS_MANAGER" ||
    role === "STAFF"
  );
}

/** Landing route for a role right after login. */
export function homeForRole(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "BUSINESS_OWNER":
    case "BUSINESS_MANAGER":
      return "/dashboard";
    case "STAFF":
      return "/dashboard/scanner";
    case "CUSTOMER":
    default:
      return "/member";
  }
}
