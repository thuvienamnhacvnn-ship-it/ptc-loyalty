import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <Brand />
      <div>
        <h1 className="text-6xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Không tìm thấy trang bạn yêu cầu.</p>
      </div>
      <Button asChild>
        <Link href="/">Về trang chủ</Link>
      </Button>
    </div>
  );
}
