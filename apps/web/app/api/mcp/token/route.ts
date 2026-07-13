import { type NextRequest, NextResponse } from "next/server";
import {
  consumeAuthCode,
  getClient,
  issueTokens,
  rotateRefreshToken,
} from "@/lib/mcp/store";
import { CORS_HEADERS, corsPreflight, verifyPkce } from "@/lib/mcp/http";

export const runtime = "nodejs";

function bad(error: string, description?: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: CORS_HEADERS },
  );
}

// Accepteert zowel form-encoded (OAuth-standaard) als JSON body.
async function readParams(req: NextRequest): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(j).map(([k, v]) => [k, String(v)]),
    );
  }
  const form = await req.formData();
  const out: Record<string, string> = {};
  form.forEach((v, k) => (out[k] = String(v)));
  return out;
}

export async function POST(req: NextRequest) {
  const p = await readParams(req);

  if (p.grant_type === "authorization_code") {
    if (!p.code || !p.redirect_uri || !p.code_verifier || !p.client_id) {
      return bad("invalid_request", "code, redirect_uri, code_verifier, client_id vereist");
    }
    const row = await consumeAuthCode(p.code);
    if (!row) return bad("invalid_grant", "code ongeldig of verlopen");
    if (row.client_id !== p.client_id) return bad("invalid_grant", "client mismatch");
    if (row.redirect_uri !== p.redirect_uri) return bad("invalid_grant", "redirect mismatch");
    if (!verifyPkce(p.code_verifier, row.code_challenge)) {
      return bad("invalid_grant", "PKCE-verificatie mislukt");
    }
    const tokens = await issueTokens({
      clientId: row.client_id,
      userId: row.user_id,
      scope: row.scope ?? "mcp",
    });
    return NextResponse.json(
      {
        access_token: tokens.accessToken,
        token_type: "Bearer",
        expires_in: tokens.expiresIn,
        refresh_token: tokens.refreshToken,
        scope: row.scope ?? "mcp",
      },
      { headers: CORS_HEADERS },
    );
  }

  if (p.grant_type === "refresh_token") {
    if (!p.refresh_token) return bad("invalid_request", "refresh_token vereist");
    // Optioneel client_id-check als meegegeven.
    if (p.client_id && !(await getClient(p.client_id))) {
      return bad("invalid_client", "onbekende client");
    }
    const tokens = await rotateRefreshToken(p.refresh_token);
    if (!tokens) return bad("invalid_grant", "refresh_token ongeldig of verlopen");
    return NextResponse.json(
      {
        access_token: tokens.accessToken,
        token_type: "Bearer",
        expires_in: tokens.expiresIn,
        refresh_token: tokens.refreshToken,
        scope: "mcp",
      },
      { headers: CORS_HEADERS },
    );
  }

  return bad("unsupported_grant_type");
}

export function OPTIONS() {
  return corsPreflight();
}
