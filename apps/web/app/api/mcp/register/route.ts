import { type NextRequest, NextResponse } from "next/server";
import { randomToken, registerClient } from "@/lib/mcp/store";
import { CORS_HEADERS, corsPreflight } from "@/lib/mcp/http";

export const runtime = "nodejs";

// RFC 7591 Dynamic Client Registration. claude.ai registreert zichzelf en
// krijgt een client_id (public client, geen secret — PKCE beveiligt de flow).
export async function POST(req: NextRequest) {
  let body: { redirect_uris?: unknown; client_name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_client_metadata" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];
  if (redirectUris.length === 0) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris vereist" },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  // Alleen https redirect-URIs toestaan (claude.ai gebruikt die).
  if (!redirectUris.every((u) => /^https:\/\//i.test(u))) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "alleen https toegestaan" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const clientId = randomToken(24);
  const clientName =
    typeof body.client_name === "string" ? body.client_name.slice(0, 200) : null;
  try {
    await registerClient(clientId, clientName, redirectUris);
  } catch (e) {
    return NextResponse.json(
      { error: "server_error", error_description: e instanceof Error ? e.message : "" },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: clientName ?? undefined,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: CORS_HEADERS },
  );
}

export function OPTIONS() {
  return corsPreflight();
}
