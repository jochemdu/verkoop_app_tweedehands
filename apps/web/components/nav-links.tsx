"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Megaphone,
  Lightbulb,
  FileText,
  UploadCloud,
  Tags,
  Settings,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventaris", icon: Boxes },
  { href: "/listings", label: "Advertenties", icon: Megaphone },
  { href: "/suggestions", label: "Suggesties", icon: Lightbulb },
  { href: "/taxatie", label: "Taxatie", icon: FileText },
  { href: "/upload", label: "Bulk upload", icon: UploadCloud },
  { href: "/stickers", label: "Stickers", icon: Tags },
  { href: "/settings", label: "Instellingen", icon: Settings },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-1 overflow-x-auto text-sm">
      {NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors ${
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              <span className="hidden lg:inline">{item.label}</span>
              <span className="sr-only lg:hidden">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
