"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { signIn } from "@/auth";
import { generateMemberCode } from "@/lib/utils";
import { recalcTier } from "@/lib/transactions";
import { findCustomerConflict } from "@/lib/customer-dedup";

export interface JoinState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const schema = z.object({
  slug: z.string().min(1),
  firstName: z.string().trim().min(1, "Nhập tên"),
  lastName: z.string().trim().optional(),
  email: z.string().email("Email không hợp lệ"),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  marketingConsent: z.coerce.boolean().optional(),
});

export async function joinBusiness(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    marketingConsent: formData.get("marketingConsent") === "on",
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const email = d.email.toLowerCase();

  const business = await db.business.findUnique({
    where: { slug: d.slug },
    include: { setting: true },
  });
  if (!business || business.status === "SUSPENDED") {
    return { error: "Doanh nghiệp không khả dụng." };
  }

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    // If already a customer of this business, just prompt login.
    const already = await db.customerProfile.findFirst({
      where: { businessId: business.id, userId: existingUser.id },
    });
    if (already) return { error: "Email đã là thành viên. Vui lòng đăng nhập." };
    return { error: "Email đã được sử dụng. Vui lòng đăng nhập." };
  }

  // Reject duplicate phone / email already used by a customer of this business.
  const conflict = await findCustomerConflict(business.id, { phone: d.phone, email });
  if (conflict === "phone") {
    return { fieldErrors: { phone: ["Số điện thoại này đã được đăng ký."] } };
  }
  if (conflict === "email") {
    return { fieldErrors: { email: ["Email này đã được đăng ký."] } };
  }

  const passwordHash = await bcrypt.hash(d.password, 10);
  const signupBonus = business.setting?.signupBonus ?? 0;

  const { customerId } = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: `${d.firstName} ${d.lastName ?? ""}`.trim(),
        email,
        passwordHash,
        role: "CUSTOMER",
        emailVerified: new Date(),
      },
    });
    const customer = await tx.customerProfile.create({
      data: {
        businessId: business.id,
        userId: user.id,
        memberCode: generateMemberCode(),
        firstName: d.firstName,
        lastName: d.lastName || null,
        email,
        phone: d.phone || null,
        marketingConsent: !!d.marketingConsent,
        pointsBalance: signupBonus,
        totalEarned: signupBonus,
      },
    });
    if (signupBonus > 0) {
      await tx.transaction.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          type: "BONUS",
          status: "COMPLETED",
          points: signupBonus,
          balanceBefore: 0,
          balanceAfter: signupBonus,
          note: "Điểm thưởng đăng ký",
        },
      });
    }
    return { customerId: customer.id };
  });

  await recalcTier(business.id, customerId);

  try {
    await signIn("credentials", { email, password: d.password, redirectTo: "/member" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Đăng ký thành công. Vui lòng đăng nhập." };
    }
    throw error;
  }
  return {};
}
