import { type NextRequest, NextResponse } from "next/server";
import { baseUrl } from "@/lib/mcp/config";
import { CORS_HEADERS, corsPreflight } from "@/lib/mcp/http";

export const runtime = "nodejs";

// RFC 8414: authorization-server metadata. Public clients + PKCE (S256).
export function GET(req: NextRequest) {
  const base = baseUrl(req);
  return NextResponse.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/mcp/authorize`,
      token_endpoint: `${base}/api/mcp/token`,
      registration_endpoint: `${base}/api/mcp/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp"],
    },
    { headers: CORS_HEADERS },
  );
}

export function OPTIONS() {
  return corsPreflight();
}
