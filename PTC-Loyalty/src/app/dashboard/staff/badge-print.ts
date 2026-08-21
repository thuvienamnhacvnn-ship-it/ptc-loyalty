"use client";

/**
 * In một tờ thẻ chấm công.
 *
 * Dùng chung cho hai chỗ: lúc nhận việc (hộp thoại thêm nhân viên) và lúc in
 * lại từ bảng nhân viên — hai nơi phải ra đúng một tờ giấy, nếu không quán sẽ
 * có hai kiểu thẻ khác nhau trong cùng một ngăn kéo.
 */

export interface BadgeSheet {
  businessName: string;
  name: string;
  /** Dòng phụ dưới tên: mã nhân viên, bộ phận… */
  subtitle?: string | null;
  dataUrl: string;
}

/** Nội dung đi thẳng vào `document.write` nên phải chặn HTML lọt vào. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printBadgeSheet(sheet: BadgeSheet): void {
  const w = window.open("", "_blank", "width=420,height=620");
  if (!w) return;
  // Cỡ vừa một thẻ nhựa bấm lỗ đeo cổ — thứ nhân viên thực sự cầm tới máy.
  w.document.write(
    `<html><head><title>Thẻ chấm công ${escapeHtml(sheet.name)}</title>
    <style>
      body{font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px;margin:0}
      .store{font-weight:700;font-size:16px;color:#0f172a;margin-bottom:2px}
      .kind{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;margin-bottom:14px}
      h2{margin:0 0 2px;font-size:20px}
      p{color:#64748b;margin:0 0 16px;font-size:13px}
      img.qr{width:280px;height:280px}
      .foot{margin-top:14px;font-size:11px;color:#94a3b8}
    </style></head>
    <body>
      <div class="store">${escapeHtml(sheet.businessName)}</div>
      <div class="kind">Thẻ chấm công</div>
      <h2>${escapeHtml(sheet.name)}</h2>
      <p>${escapeHtml(sheet.subtitle ?? "")}</p>
      <img class="qr" src="${sheet.dataUrl}" alt="QR" />
      <div class="foot">Quét thẻ này ở máy chấm công khi vào ca và khi tan ca.</div>
      <script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}</script>
    </body></html>`,
  );
  w.document.close();
}
