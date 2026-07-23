import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/mcp/store";

// OAuth authorization endpoint (consent). claude.ai opent deze URL; de
// gebruiker moet ingelogd zijn (hergebruikt de bestaande app-sessie) en
// bevestigt dat de connector namens hem z'n eigen inventaris mag lezen/schrijven.
export default async function McpAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("mcpConsent");
  const sp = await searchParams;
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;

  const responseType = get("response_type");
  const clientId = get("client_id");
  const redirectUri = get("redirect_uri");
  const codeChallenge = get("code_challenge");
  const codeChallengeMethod = get("code_challenge_method");
  const state = get("state");
  const scope = get("scope") ?? "mcp";

  function invalid(reason: string) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">{t("authFailed")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
      </Shell>
    );
  }

  if (responseType !== "code") return invalid(t("invalidResponseType"));
  if (!clientId || !redirectUri || !codeChallenge) {
    return invalid(t("missingParams"));
  }
  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return invalid(t("pkceOnly"));
  }
  const client = await getClient(clientId);
  if (!client) return invalid(t("unknownClient"));
  if (!client.redirect_uris.includes(redirectUri)) {
    return invalid(t("redirectMismatch"));
  }

  // Toon duidelijk wélke connector koppelt en waar hij na goedkeuren heen
  // stuurt — zodat de gebruiker een onbekende/kwaadaardige client herkent.
  const clientName = client.client_name?.trim() || "Claude";
  let redirectHost = redirectUri;
  try {
    redirectHost = new URL(redirectUri).host;
  } catch {
    /* laat de volledige uri staan als hij niet parsebaar is */
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">{t("loginFirstTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("loginFirstBody")}</p>
        <Link href="/login" className="btn btn-accent mt-4 w-full">
          {t("loginBtn")}
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">{t("loginHint")}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold">{t("connectTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("connectBody", { client: clientName })}
      </p>
      <div className="mt-3 space-y-1 rounded-lg border border-border bg-muted p-3 text-xs">
        <p className="text-muted-foreground">{t("loggedInAs", { email: user.email ?? "" })}</p>
        <p className="text-muted-foreground">{t("redirectNote", { host: redirectHost })}</p>
      </div>

      <form action="/api/mcp/authorize" method="POST" className="mt-4 space-y-2">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="code_challenge" value={codeChallenge} />
        <input type="hidden" name="state" value={state ?? ""} />
        <input type="hidden" name="scope" value={scope} />
        <button type="submit" className="btn btn-accent w-full">
          {t("authorizeBtn")}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">{children}</div>
    </main>
  );
}
