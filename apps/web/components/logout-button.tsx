"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const t = useTranslations("nav");
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button onClick={logout} className="btn btn-ghost" title={t("logout")}>
      <LogOut className="size-4" aria-hidden />
      <span className="hidden sm:inline">{t("logout")}</span>
      <span className="sr-only sm:hidden">{t("logout")}</span>
    </button>
  );
}
