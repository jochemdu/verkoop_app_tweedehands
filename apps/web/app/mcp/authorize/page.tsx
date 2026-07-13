import Link from "next/link";
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
        <h1 className="text-xl font-bold">Autorisatie mislukt</h1>
        <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
      </Shell>
    );
  }

  if (responseType !== "code") return invalid("Ongeldig response_type.");
  if (!clientId || !redirectUri || !codeChallenge) {
    return invalid("Ontbrekende parameters (client_id, redirect_uri, code_challenge).");
  }
  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return invalid("Alleen PKCE S256 wordt ondersteund.");
  }
  const client = await getClient(clientId);
  if (!client) return invalid("Onbekende client. Verwijder de connector en voeg hem opnieuw toe.");
  if (!client.redirect_uris.includes(redirectUri)) {
    return invalid("redirect_uri hoort niet bij deze client.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Shell>
        <h1 className="text-xl font-bold">Log eerst in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Je moet in dit tabblad ingelogd zijn op VerkoopAssistent om de
          connector te koppelen.
        </p>
        <Link href="/login" className="btn btn-accent mt-4 w-full">
          Inloggen
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">
          Log in en klik daarna in claude.ai opnieuw op &quot;connect&quot;.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold">Connector koppelen</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Je staat op het punt <strong>Claude</strong> toegang te geven tot jouw
        VerkoopAssistent-inventaris (alleen <em>jouw</em> producten, foto&apos;s,
        advertenties en marktonderzoek). Je kunt dit later intrekken.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Ingelogd als {user.email}
      </p>

      <form action="/api/mcp/authorize" method="POST" className="mt-4 space-y-2">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="code_challenge" value={codeChallenge} />
        <input type="hidden" name="state" value={state ?? ""} />
        <input type="hidden" name="scope" value={scope} />
        <button type="submit" className="btn btn-accent w-full">
          Autoriseer Claude
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
