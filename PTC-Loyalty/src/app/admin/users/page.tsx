import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import { UserActions } from "./user-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/format";
import type { Prisma, UserRole } from "@prisma/client";

export const metadata: Metadata = { title: "Admin · Người dùng" };

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super admin",
  BUSINESS_OWNER: "Chủ doanh nghiệp",
  BUSINESS_MANAGER: "Quản lý",
  STAFF: "Nhân viên",
  CUSTOMER: "Khách hàng",
};

const ROLE_VARIANT: Record<UserRole, "warning" | "default" | "secondary"> = {
  SUPER_ADMIN: "warning",
  BUSINESS_OWNER: "default",
  BUSINESS_MANAGER: "secondary",
  STAFF: "secondary",
  CUSTOMER: "secondary",
};

const ROLE_VALUES = Object.keys(ROLE_LABELS) as UserRole[];

function isRole(value: string): value is UserRole {
  return (ROLE_VALUES as string[]).includes(value);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const admin = await requirePlatformAdmin();
  const { q, role } = await searchParams;
  const query = q?.trim() ?? "";

  const where: Prisma.UserWhereInput = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(role && isRole(role) ? { role } : {}),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        ownedBusinesses: { select: { id: true, name: true } },
        staffProfiles: {
          select: { business: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    }),
    db.user.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Người dùng</h2>
        <p className="text-sm text-muted-foreground">
          {formatNumber(total)} tài khoản
          {total > users.length && ` · hiển thị ${formatNumber(users.length)} mới nhất`}
          .
        </p>
      </div>

      {/* Plain GET form — search works without client JS. */}
      <form className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <Input
            name="q"
            defaultValue={query}
            placeholder="Tìm theo tên hoặc email…"
          />
        </div>
        <select
          name="role"
          defaultValue={role && isRole(role) ? role : ""}
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Tất cả vai trò</option>
          {ROLE_VALUES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" /> Tìm
        </Button>
        {(query || role) && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/admin/users">Xóa lọc</Link>
          </Button>
        )}
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Doanh nghiệp</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Tạo</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Không có tài khoản nào khớp bộ lọc.
                  </TableCell>
                </TableRow>
              )}
              {users.map((u) => {
                // Owners are linked via ownedBusinesses; managers/staff via StaffProfile.
                const business =
                  u.ownedBusinesses[0] ?? u.staffProfiles[0]?.business ?? null;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell className="text-sm">
                      {business ? (
                        <Link
                          href={`/admin/businesses/${business.id}`}
                          className="hover:underline"
                        >
                          {business.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROLE_VARIANT[u.role]}>
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "success" : "destructive"}>
                        {u.isActive ? "Hoạt động" : "Khóa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell>
                      <UserActions
                        user={{
                          id: u.id,
                          name: u.name,
                          email: u.email,
                          role: u.role,
                          locale: u.locale,
                          isActive: u.isActive,
                        }}
                        isSelf={u.id === admin.id}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
