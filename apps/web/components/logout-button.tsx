"use client";

import { useRouter } from "next/navigation";
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
    <button
      onClick={logout}
      className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
    >
      Uitloggen
    </button>
  );
}
