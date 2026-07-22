// Transactional email. Uses Resend (https://resend.com) via its REST API when
// RESEND_API_KEY is set; otherwise logs the message to the server console so the
// full flow works in development without any provider configured.
//
// Env:
//   RESEND_API_KEY  — Resend API key (optional; emails are mocked when absent)
//   EMAIL_FROM      — sender, e.g. "PTC Loyalty <no-reply@your-domain.com>"
//                     (Resend's shared "onboarding@resend.dev" works for tests)

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  mocked?: boolean;
  error?: string;
}

const FROM = process.env.EMAIL_FROM || "PTC Loyalty <onboarding@resend.dev>";

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  // No provider configured → log instead of sending (dev-friendly, never fails).
  if (!apiKey) {
    console.log("\n[email:MOCK] RESEND_API_KEY not set — email not actually sent");
    console.log("  to     :", input.to);
    console.log("  from   :", FROM);
    console.log("  subject:", input.subject);
    console.log("  text   :", input.text ?? "(html only)");
    console.log("");
    return { ok: true, mocked: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "email_error" };
  }
}

function shell(inner: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">${inner}</div>`;
}

/** Birthday greeting; includes a voucher code + expiry when one was issued. */
export function birthdayEmailHtml(input: {
  name: string;
  storeName: string;
  voucherCode?: string | null;
  voucherTitle?: string | null;
  expires?: string | null;
}): string {
  const voucher = input.voucherCode
    ? `<div style="margin:16px 0;padding:16px;border:1px dashed #f97316;border-radius:12px;text-align:center">
         <div style="color:#475569;font-size:13px">${input.voucherTitle ?? "Ưu đãi sinh nhật"}</div>
         <div style="font-size:22px;font-weight:800;letter-spacing:1px;color:#ea580c">${input.voucherCode}</div>
         ${input.expires ? `<div style="color:#94a3b8;font-size:12px">Dùng trước ${input.expires}</div>` : ""}
       </div>`
    : "";
  return shell(`
    <h2 style="margin:0 0 8px">🎂 Chúc mừng sinh nhật, ${input.name}!</h2>
    <p style="margin:0 0 12px;color:#475569">
      ${input.storeName} chúc bạn một ngày sinh nhật thật vui vẻ và hạnh phúc.
    </p>
    ${voucher}
    <p style="margin:0;color:#475569">Hẹn gặp bạn sớm! ❤️</p>`);
}

/** "We miss you" win-back email for inactive customers. */
export function winbackEmailHtml(input: {
  name: string;
  storeName: string;
  pointsBalance: number;
  url?: string | null;
}): string {
  const cta = input.url
    ? `<p style="margin:16px 0"><a href="${input.url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Xem ưu đãi</a></p>`
    : "";
  return shell(`
    <h2 style="margin:0 0 8px">Chúng tôi nhớ bạn 👋</h2>
    <p style="margin:0 0 12px;color:#475569">
      Chào ${input.name}, đã lâu rồi bạn chưa ghé ${input.storeName}. Bạn đang có
      <b>${input.pointsBalance} điểm</b> — quay lại để tích thêm và đổi quà nhé!
    </p>
    ${cta}
    <p style="margin:0;color:#94a3b8;font-size:12px">Hẹn gặp lại bạn sớm.</p>`);
}

/** Password-reset email body (kept simple + inline-styled for mail clients). */
export function passwordResetEmailHtml(name: string, link: string): string {
  const greeting = name ? `Xin chào ${name},` : "Xin chào,";
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 8px">Đặt lại mật khẩu</h2>
    <p style="margin:0 0 16px;color:#475569">${greeting}</p>
    <p style="margin:0 0 16px;color:#475569">
      Bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản PTC Loyalty. Nhấp
      vào nút bên dưới để tạo mật khẩu mới. Liên kết sẽ hết hạn sau <b>1 giờ</b>.
    </p>
    <p style="margin:0 0 24px">
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
        Đặt lại mật khẩu
      </a>
    </p>
    <p style="margin:0 0 8px;color:#94a3b8;font-size:12px">
      Nếu nút không hoạt động, hãy dán liên kết này vào trình duyệt:
    </p>
    <p style="margin:0 0 24px;word-break:break-all;font-size:12px;color:#2563eb">${link}</p>
    <p style="margin:0;color:#94a3b8;font-size:12px">
      Nếu bạn không yêu cầu điều này, hãy bỏ qua email — mật khẩu của bạn không thay đổi.
    </p>
  </div>`;
}
