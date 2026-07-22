import { requirePlatformAdmin } from "@/lib/tenant";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePlatformAdmin();
  return <AdminShell userName={user.name ?? user.email}>{children}</AdminShell>;
}
