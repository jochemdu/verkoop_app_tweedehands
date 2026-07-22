"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// Fase 48: accepteert een workspace-uitnodiging via de SECURITY DEFINER rpc.
// De uitnodiging zelf is niet leesbaar (RLS) tot je lid bent; de rpc valideert
// token + e-mail-match en voegt je toe.
const ERROR_KEY: Record<string, string> = {
  invite_not_found: "errInvalid",
  invite_already_used: "errUsed",
  invite_expired: "errExpired",
  invite_email_mismatch: "errEmail",
  not_authenticated: "errAuth",
};

export function InviteAccept({ token }: { token: string }) {
  const t = useTranslations("invite");
  const router = useRouter();
  const supabase = createClient();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setState("busy");
    setError(null);
    const { error: err } = await supabase.rpc("accept_workspace_invite", {
      p_token: token,
    });
    if (err) {
      const code = Object.keys(ERROR_KEY).find((k) => err.message.includes(k));
      setError(code ? t(ERROR_KEY[code]!) : t("errInvalid"));
      setState("idle");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <div className="space-y-4">
        <p className="text-success">{t("accepted")}</p>
        <button
          onClick={() => router.push("/inventory")}
          className="btn btn-accent"
        >
          {t("goToApp")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        onClick={accept}
        disabled={state === "busy"}
        className="btn btn-accent"
      >
        {state === "busy" ? t("accepting") : t("accept")}
      </button>
    </div>
  );
}
