"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Boxes,
  Megaphone,
  Lightbulb,
  Package,
  FileText,
  UploadCloud,
  Tags,
  Settings,
} from "lucide-react";
import type { Messages } from "@verkoopassistent/shared";

const NAV: Array<{ href: string; key: keyof Messages["nav"]; icon: typeof Boxes }> = [
  { href: "/", key: "dashboard", icon: LayoutDashboard },
  { href: "/inventory", key: "inventory", icon: Boxes },
  { href: "/listings", key: "listings", icon: Megaphone },
  { href: "/suggestions", key: "suggestions", icon: Lightbulb },
  { href: "/bundles", key: "bundles", icon: Package },
  { href: "/taxatie", key: "taxatie", icon: FileText },
  { href: "/upload", key: "upload", icon: UploadCloud },
  { href: "/stickers", key: "stickers", icon: Tags },
  { href: "/settings", key: "settings", icon: Settings },
];

export function NavLinks() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <ul className="flex items-center gap-1 overflow-x-auto text-sm">
      {NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const label = t(item.key);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              title={label}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors ${
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              <span className="hidden lg:inline">{label}</span>
              <span className="sr-only lg:hidden">{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
