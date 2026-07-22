"use server";

import { AuthError } from "next-auth";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { signIn, signOut } from "@/auth";
import {
  ensurePlans,
  provisionBusiness,
  generateUniqueBusinessSlug,
} from "@/lib/provision";
import { homeForRole } from "@/lib/rbac";

export async function logout() {
  await signOut({ redirectTo: "/" });
}

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export async function login(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // Route by role after a successful sign-in.
  const existing = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { role: true },
  });
  const redirectTo = existing ? homeForRole(existing.role) : "/dashboard";

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email hoặc mật khẩu không đúng." };
    }
    throw error; // redirect() throws — rethrow so Next handles it
  }
  return {};
}

// Note: `slug` is intentionally NOT part of this schema. It is generated on the
// server (see generateUniqueBusinessSlug) and any `slug` the client might send
// is ignored — clients must not be able to choose or override it.
const registerSchema = z.object({
  businessName: z.string().min(2, "Tên doanh nghiệp quá ngắn"),
  businessType: z.string().min(1, "Chọn loại hình"),
  ownerName: z.string().min(2, "Nhập họ tên"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
});

export async function registerBusiness(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    businessName: formData.get("businessName"),
    businessType: formData.get("businessType"),
    ownerName: formData.get("ownerName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  const email = data.email.toLowerCase();

  const emailTaken = await db.user.findUnique({ where: { email } });
  if (emailTaken) return { error: "Email đã được sử dụng." };

  await ensurePlans();
  const passwordHash = await bcrypt.hash(data.password, 10);

  // Create User + Business (+ branding/settings/subscription/tiers/branch) +
  // owner StaffProfile atomically. The slug is generated server-side inside the
  // transaction; on the near-impossible unique collision we regenerate & retry
  // instead of failing the sign-up.
  let created = false;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: data.ownerName,
            email,
            passwordHash,
            role: "BUSINESS_OWNER",
            emailVerified: new Date(), // demo: auto-verify
          },
        });
        const slug = await generateUniqueBusinessSlug(tx);
        await provisionBusiness({
          ownerId: user.id,
          name: data.businessName,
          type: data.businessType,
          slug,
          email,
          tx,
        });
      });
      created = true;
    } catch (e) {
      const isSlugCollision =
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        (e.meta?.target as string[] | undefined)?.includes?.("slug");
      if (isSlugCollision) continue; // regenerate slug on next iteration
      throw e;
    }
  }
  if (!created) {
    return { error: "Không thể tạo doanh nghiệp, vui lòng thử lại." };
  }

  try {
    await signIn("credentials", {
      email,
      password: data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Đăng ký thành công nhưng đăng nhập thất bại. Hãy đăng nhập lại." };
    }
    throw error;
  }
  return {};
}
