import { BrowserWindow } from "electron";

// ─────────────────────────────────────────────────────────────────────────────
// Silent receipt printing. Renders a small HTML receipt in an offscreen window
// and prints it to the default (or a chosen) printer with no OS dialog.
// ─────────────────────────────────────────────────────────────────────────────

export interface ReceiptData {
  businessName: string;
  branchName: string | null;
  staffName: string;
  customerName: string;
  memberCode: string;
  kind: "EARN" | "REDEEM" | "VOUCHER";
  points: number;
  amount: number | null;
  balanceAfter: number;
  extra: string | null;
  when: string; // formatted timestamp
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function receiptHtml(d: ReceiptData): string {
  const title =
    d.kind === "EARN" ? "CỘNG ĐIỂM" : d.kind === "REDEEM" ? "ĐỔI ĐIỂM" : "VOUCHER";
  const line = (label: string, value: string) =>
    `<div class="row"><span>${esc(label)}</span><span>${esc(value)}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { font-family: 'Segoe UI', Arial, sans-serif; }
    body { width: 280px; margin: 0; padding: 8px; color: #000; }
    h1 { font-size: 15px; text-align: center; margin: 4px 0; }
    .muted { text-align:center; font-size: 11px; color:#333; margin-bottom:6px; }
    .title { text-align:center; font-weight:700; font-size:13px; letter-spacing:1px; margin:8px 0; }
    .row { display:flex; justify-content:space-between; font-size:12px; margin:3px 0; }
    .big { font-size:20px; font-weight:700; text-align:center; margin:8px 0; }
    hr { border:none; border-top:1px dashed #999; margin:8px 0; }
    .foot { text-align:center; font-size:10px; color:#555; margin-top:8px; }
  </style></head><body>
    <h1>${esc(d.businessName)}</h1>
    ${d.branchName ? `<div class="muted">${esc(d.branchName)}</div>` : ""}
    <div class="title">${title}</div>
    <hr/>
    ${line("Khách hàng", d.customerName)}
    ${line("Mã TV", d.memberCode)}
    ${d.amount != null ? line("Hóa đơn", `€ ${d.amount.toFixed(2)}`) : ""}
    <div class="big">${d.points >= 0 ? "+" : ""}${d.points} điểm</div>
    ${line("Số dư mới", `${d.balanceAfter} P`)}
    ${d.extra ? line("Ghi chú", d.extra) : ""}
    <hr/>
    ${line("Nhân viên", d.staffName)}
    ${line("Thời gian", d.when)}
    <div class="foot">Cảm ơn quý khách! · PTC Loyalty</div>
  </body></html>`;
}

export async function printReceipt(
  data: ReceiptData,
  printerName: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false },
  });
  try {
    const html = receiptHtml(data);
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      win.webContents.print(
        {
          silent: true,
          printBackground: true,
          margins: { marginType: "none" },
          ...(printerName ? { deviceName: printerName } : {}),
        },
        (success, failureReason) => {
          resolve(success ? { ok: true } : { ok: false, error: failureReason });
        },
      );
    });
    return result;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    win.close();
  }
}

/** Enumerate installed printers (for the Settings screen). */
export async function listPrinters(): Promise<
  { name: string; displayName: string; isDefault: boolean }[]
> {
  const win = new BrowserWindow({ show: false });
  try {
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: p.isDefault,
    }));
  } catch {
    return [];
  } finally {
    win.close();
  }
}
