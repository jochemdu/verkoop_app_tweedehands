import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClient, randomToken, saveAuthCode } from "@/lib/mcp/store";

export const runtime = "nodejs";

// Consent-approval: alleen bereikbaar vanuit het formulier op /mcp/authorize
// (ingelogde gebruiker). Genereert de authorization code en stuurt terug naar
// claude.ai's redirect_uri.
export async function POST(req: NextRequest) {
  // Defense-in-depth tegen CSRF (naast de SameSite=Lax sessie-cookie): het
  // consent-formulier moet vanaf onze eigen origin komen.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const form = await req.formData();
  const clientId = String(form.get("client_id") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const codeChallenge = String(form.get("code_challenge") ?? "");
  const state = String(form.get("state") ?? "");
  const scope = String(form.get("scope") ?? "mcp");

  if (!clientId || !redirectUri || !codeChallenge) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  // Client + redirect opnieuw valideren (niet vertrouwen op verborgen velden).
  const client = await getClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = randomToken();
  await saveAuthCode({
    code,
    clientId,
    userId: user.id,
    redirectUri,
    codeChallenge,
    scope,
  });

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  return NextResponse.redirect(target.toString(), { status: 302 });
}
