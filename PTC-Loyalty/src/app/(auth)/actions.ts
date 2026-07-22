"use server";

import crypto from "node:crypto";
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
import { sendEmail, passwordResetEmailHtml } from "@/lib/email";

export async function logout() {
  await signOut({ redirectTo: "/" });
}

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

// ── Password reset (forgot → email link → reset) ─────────────────────────────

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** We store only the SHA-256 of the reset token, so a DB leak cannot reset
 *  anyone's password. The raw token lives only in the emailed link. */
function hashResetToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export interface ResetRequestState extends ActionState {
  sent?: boolean;
}

const forgotSchema = z.object({ email: z.string().email("Email không hợp lệ") });

/** Step 1: user submits their email → we email a time-boxed reset link. */
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const email = parsed.data.email.toLowerCase();

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, isActive: true },
  });

  // Only actually send when the account exists & is active — but ALWAYS return
  // the same success state so we never leak which emails are registered.
  if (user && user.isActive) {
    const raw = crypto.randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    // One active reset token per email: drop older ones, store the new hash.
    await db.verificationToken.deleteMany({ where: { identifier: email } });
    await db.verificationToken.create({
      data: { identifier: email, token: hashResetToken(raw), expires },
    });

    const link = `${appUrl()}/reset-password?token=${raw}&email=${encodeURIComponent(email)}`;
    await sendEmail({
      to: email,
      subject: "Đặt lại mật khẩu — PTC Loyalty",
      text: `Đặt lại mật khẩu (hết hạn sau 1 giờ): ${link}`,
      html: passwordResetEmailHtml(user.name ?? "", link),
    });
  }

  return { sent: true };
}

export interface ResetPasswordState extends ActionState {
  done?: boolean;
}

const resetSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
});

/** Step 2: user submits a new password with the token from the email link. */
export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const email = parsed.data.email.toLowerCase();

  const record = await db.verificationToken.findUnique({
    where: {
      identifier_token: { identifier: email, token: hashResetToken(parsed.data.token) },
    },
  });
  if (!record || record.expires < new Date()) {
    return { error: "Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  // Update the hash (used by BOTH web login and desktop POS login) and consume
  // every reset token for this email in one atomic step (single-use).
  await db.$transaction([
    db.user.update({ where: { email }, data: { passwordHash } }),
    db.verificationToken.deleteMany({ where: { identifier: email } }),
  ]);

  return { done: true };
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
