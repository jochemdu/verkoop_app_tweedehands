import Link from "next/link";
import { Bell, Tag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { NavLinks } from "@/components/nav-links";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const t = await getTranslations("alerts");
  const { count: unreadAlerts } = await supabase
    .from("price_alerts")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  return (
    <div className="min-h-screen">
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
            <NavLinks />
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <span className="hidden text-xs text-muted-foreground xl:inline">
              {user?.email}
            </span>
            <Link
              href="/alerts"
              title={t("navTitle")}
              aria-label={t("navTitle")}
              className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="size-4" aria-hidden />
              {!!unreadAlerts && unreadAlerts > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-accent-foreground">
                  {unreadAlerts > 9 ? "9+" : unreadAlerts}
                </span>
              )}
            </Link>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
