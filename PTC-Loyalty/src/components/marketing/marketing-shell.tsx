import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <MarketingShell>
      <article className="container max-w-3xl py-16">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cập nhật lần cuối: {updated}</p>
        <div className="prose prose-neutral mt-8 max-w-none space-y-4 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_strong]:text-foreground">
          {children}
        </div>
      </article>
    </MarketingShell>
  );
}
