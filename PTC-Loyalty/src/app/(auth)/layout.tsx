import Link from "next/link";
import { Brand } from "@/components/brand";
import { ModeToggle } from "@/components/mode-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-16 items-center justify-between">
        <Link href="/">
          <Brand />
        </Link>
        <ModeToggle />
      </header>
      <main className="container flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
