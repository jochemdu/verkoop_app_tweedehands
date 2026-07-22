import Link from "next/link";
import { Bell, Tag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { NavLinks } from "@/components/nav-links";
import { MobileNav } from "@/components/mobile-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [t, tn] = await Promise.all([
    getTranslations("alerts"),
    getTranslations("nav"),
  ]);
  const { count: unreadAlerts } = await supabase
    .from("price_alerts")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only left-4 top-3 z-50 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground focus:not-sr-only focus:absolute"
      >
        {tn("skipToContent")}
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-5">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Tag className="size-4" aria-hidden />
              </span>
              <span className="font-heading text-[15px] font-semibold tracking-tight">
                VerkoopAssistent
              </span>
            </Link>
            <div className="hidden lg:block">
              <NavLinks />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-sm">
            <span className="mr-2 hidden text-xs text-muted-foreground xl:inline">
              {user?.email}
            </span>
            <Link
              href="/alerts"
              title={t("navTitle")}
              aria-label={t("navTitle")}
              className="btn-icon relative"
            >
              <Bell className="size-5" aria-hidden />
              {!!unreadAlerts && unreadAlerts > 0 && (
                <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-accent-foreground">
                  {unreadAlerts > 9 ? "9+" : unreadAlerts}
                </span>
              )}
            </Link>
            <LogoutButton />
          </div>
        </nav>
      </header>

      <div
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 pb-24 pt-8 focus:outline-none sm:px-6 lg:pb-12"
      >
        {children}
      </div>

      <MobileNav />
    </div>
  );
}
