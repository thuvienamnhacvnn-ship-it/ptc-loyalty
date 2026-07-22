import type { Metadata } from "next";
import { requireBusinessContext } from "@/lib/tenant";
import { ScannerClient } from "./scanner-client";

export const metadata: Metadata = { title: "Quét QR" };

export default async function ScannerPage() {
  // Guard: any business staff role may access the scanner.
  await requireBusinessContext();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Quét mã QR thành viên hoặc tìm khách thủ công để cộng điểm.
      </p>
      <ScannerClient />
    </div>
  );
}
