"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Mail, Unlink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type Identity = {
  identity_id: string;
  provider: string;
  email: string | null;
};

const PROVIDER_LABEL: Record<string, string> = {
  email: "E-mail (magic link)",
  google: "Google",
};

// Fase 30: meerdere login-methodes aan één account koppelen. Google-koppeling
// gebruikt Supabase manual identity linking, zodat je met je Gmail in
// hetzelfde account (en dus dezelfde inventaris) landt als je magic-link-mail.
export function LinkedAccounts({ identities }: { identities: Identity[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const hasGoogle = identities.some((i) => i.provider === "google");

  async function linkGoogle() {
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/settings` },
      });
      if (error) {
        toast.error(
          error.message.includes("Manual linking")
            ? "Manual linking staat uit in Supabase (Authentication → Settings)."
            : `Koppelen mislukt: ${error.message}`,
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
      toast.error("Je kunt je laatste login-methode niet ontkoppelen.");
      return;
    }
    if (!window.confirm(`${PROVIDER_LABEL[identity.provider] ?? identity.provider} ontkoppelen?`))
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
        toast.error("Identity niet gevonden — herlaad de pagina.");
        return;
      }
      const { error } = await supabase.auth.unlinkIdentity(target);
      if (error) {
        toast.error(`Ontkoppelen mislukt: ${error.message}`);
        return;
      }
      toast.success("Login-methode ontkoppeld");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="section-title">Login-methodes</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Koppel meerdere manieren om in te loggen aan dit ene account — handig
          als je zowel je e-mail als je Google-account wilt gebruiken.
        </p>
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
              <span className="font-medium">
                {PROVIDER_LABEL[i.provider] ?? i.provider}
              </span>
              {i.email && (
                <span className="block text-xs text-muted-foreground">{i.email}</span>
              )}
            </span>
            {identities.length > 1 && (
              <button
                type="button"
                onClick={() => unlink(i)}
                disabled={busy}
                title="Ontkoppelen"
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
          {busy ? "Bezig…" : "Koppel Google-account"}
        </button>
      )}
    </section>
  );
}
