import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Inventaris" },
  { href: "/listings", label: "Advertenties" },
  { href: "/taxatie", label: "Taxatie" },
  { href: "/upload", label: "Bulk upload" },
  { href: "/stickers", label: "Stickers" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <nav className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold">
              VerkoopAssistent
            </Link>
            <ul className="flex gap-4 text-sm text-muted-foreground">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{user?.email}</span>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <div className="mx-auto max-w-6xl p-6">{children}</div>
    </div>
  );
}
