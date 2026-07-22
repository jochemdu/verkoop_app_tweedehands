"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NAV, isActive } from "@/lib/nav";

// Header-navigatie (desktop). Op < lg toont de shell in plaats hiervan de
// mobiele onder-tabbar (mobile-nav.tsx).
export function NavLinks() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <ul className="flex items-center gap-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        const label = t(item.key);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`nav-item ${active ? "nav-item-active" : ""}`}
            >
              <Icon className="size-4" aria-hidden />
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
