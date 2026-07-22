"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal, X } from "lucide-react";
import { PRIMARY_NAV, SECONDARY_NAV, isActive } from "@/lib/nav";

// Mobiele onder-tabbar (fase 51): vier duim-bereikbare kernroutes + een
// 'Meer'-sheet voor de rest. Alleen zichtbaar onder lg; daarboven staat de
// volledige header-nav. Respecteert de safe-area op iOS.
export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [sheetOpen, setSheetOpen] = useState(false);

  const moreActive = SECONDARY_NAV.some((n) => isActive(pathname, n.href));

  return (
    <>
      <nav
        aria-label={t("dashboard")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                    active ? "text-accent" : "text-muted-foreground"
                  }`}
                >
                  {active && (
                    <span
                      className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent"
                      aria-hidden
                    />
                  )}
                  <Icon className="size-5" aria-hidden />
                  <span className="max-w-full truncate px-1">{t(item.key)}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className={`flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                moreActive ? "text-accent" : "text-muted-foreground"
              }`}
            >
              <MoreHorizontal className="size-5" aria-hidden />
              <span>{t("more")}</span>
            </button>
          </li>
        </ul>
      </nav>

      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("more")}
          className="fixed inset-0 z-50 lg:hidden"
        >
          <button
            type="button"
            aria-label={t("more")}
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <span className="section-title">{t("more")}</span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label={t("more")}
                className="btn-icon"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-2">
              {SECONDARY_NAV.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setSheetOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center text-xs font-medium transition-colors ${
                        active
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-5" aria-hidden />
                      <span className="max-w-full truncate">{t(item.key)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
