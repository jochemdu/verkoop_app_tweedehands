"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button onClick={logout} className="btn btn-ghost" title="Uitloggen">
      <LogOut className="size-4" aria-hidden />
      <span className="hidden sm:inline">Uitloggen</span>
      <span className="sr-only sm:hidden">Uitloggen</span>
    </button>
  );
}
