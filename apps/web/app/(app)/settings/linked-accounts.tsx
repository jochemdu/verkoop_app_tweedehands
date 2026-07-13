"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Link2, Mail, Unlink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type Identity = {
  identity_id: string;
  provider: string;
  email: string | null;
};

// Fase 30: meerdere login-methodes aan één account koppelen. Google-koppeling
// gebruikt Supabase manual identity linking, zodat je met je Gmail in
// hetzelfde account (en dus dezelfde inventaris) landt als je magic-link-mail.
export function LinkedAccounts({ identities }: { identities: Identity[] }) {
  const router = useRouter();
  const t = useTranslations("settings");
  const [busy, setBusy] = useState(false);
  const hasGoogle = identities.some((i) => i.provider === "google");
  const providerLabel = (provider: string) =>
    provider === "google" ? "Google" : t("providerEmail");

  async function linkGoogle() {
    setBusy(true);
    try {
      const supabase = createClient();
      // Bare callback-URL (geen ?next=): Supabase valideert redirectTo tegen
      // de Redirect URLs-allowlist en zou bij een query-string terugvallen op
      // de Site URL. Na het koppelen landt de gebruiker op het dashboard.
      const { data, error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        toast.error(
          error.message.includes("Manual linking")
            ? t("manualLinkingOff")
            : t("linkFailed", { msg: error.message }),
        );
        return;
      }
      if (data?.url) window.location.href = data.url; // → Google OAuth
    } finally {
      setBusy(false);
    }
  }

  async function unlink(identity: Identity) {
    if (identities.length <= 1) {
      toast.error(t("cannotUnlinkLast"));
      return;
    }
    if (!window.confirm(t("confirmUnlink", { provider: providerLabel(identity.provider) })))
      return;
    setBusy(true);
    try {
      const supabase = createClient();
      // getUserIdentities levert het volledige identity-object dat unlinkIdentity vereist.
      const { data: fresh } = await supabase.auth.getUserIdentities();
      const target = fresh?.identities?.find(
        (i) => i.identity_id === identity.identity_id,
      );
      if (!target) {
        toast.error(t("identityNotFound"));
        return;
      }
      const { error } = await supabase.auth.unlinkIdentity(target);
      if (error) {
        toast.error(t("unlinkFailed", { msg: error.message }));
        return;
      }
      toast.success(t("unlinked"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="section-title">{t("loginMethods")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("linkedHelp")}</p>
      </div>

      <ul className="divide-y divide-border">
        {identities.map((i) => (
          <li key={i.identity_id} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {i.provider === "google" ? (
                <Link2 className="size-4" aria-hidden />
              ) : (
                <Mail className="size-4" aria-hidden />
              )}
            </span>
            <span className="flex-1 truncate">
              <span className="font-medium">{providerLabel(i.provider)}</span>
              {i.email && (
                <span className="block text-xs text-muted-foreground">{i.email}</span>
              )}
            </span>
            {identities.length > 1 && (
              <button
                type="button"
                onClick={() => unlink(i)}
                disabled={busy}
                title={t("unlink")}
                className="btn btn-ghost p-1.5 text-muted-foreground hover:text-destructive"
              >
                <Unlink className="size-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>

      {!hasGoogle && (
        <button
          type="button"
          onClick={linkGoogle}
          disabled={busy}
          className="btn btn-outline"
        >
          <Link2 className="size-4" aria-hidden />
          {busy ? t("busy") : t("linkGoogle")}
        </button>
      )}
    </section>
  );
}
