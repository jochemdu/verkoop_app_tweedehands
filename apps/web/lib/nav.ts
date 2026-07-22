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
  type LucideIcon,
} from "lucide-react";
import type { Messages } from "@verkoopassistent/shared";

export type NavItem = {
  href: string;
  key: keyof Messages["nav"];
  icon: LucideIcon;
};

// Gedeelde navigatie-definitie (fase 51). De header-nav toont alles op lg+;
// de mobiele onder-tabbar toont PRIMARY en verpakt de rest in een 'Meer'-sheet.
export const NAV: NavItem[] = [
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

// De vier duim-bereikbare kernroutes voor de mobiele onder-tabbar.
export const PRIMARY_HREFS = ["/", "/inventory", "/listings", "/suggestions"];

export const PRIMARY_NAV = NAV.filter((n) => PRIMARY_HREFS.includes(n.href));
export const SECONDARY_NAV = NAV.filter((n) => !PRIMARY_HREFS.includes(n.href));

export function isActive(pathname: string, href: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}
