import "server-only";
import { createHash } from "node:crypto";

// claude.ai fetcht deze endpoints cross-origin → permissieve CORS. Er staat
// geen geheime data in de metadata; de MCP-data zit achter de bearer-token.
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// PKCE S256: base64url(sha256(verifier)) === challenge
export function verifyPkce(verifier: string, challenge: string): boolean {
  const hashed = createHash("sha256").update(verifier).digest("base64url");
  return hashed === challenge;
}
