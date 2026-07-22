import { requirePlatformAdmin } from "@/lib/tenant";
import { AdminShell } from "@/components/admin/admin-shell";

// Admin pages are per-request and query the DB; never prerender them at build.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePlatformAdmin();
  return <AdminShell userName={user.name ?? user.email}>{children}</AdminShell>;
}
