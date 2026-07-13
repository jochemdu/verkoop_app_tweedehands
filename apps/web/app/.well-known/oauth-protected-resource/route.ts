import { type NextRequest, NextResponse } from "next/server";
import { baseUrl, MCP_PATH } from "@/lib/mcp/config";
import { CORS_HEADERS, corsPreflight } from "@/lib/mcp/http";

export const runtime = "nodejs";

// RFC 9728: vertelt de MCP-client waar de authorization server staat.
export function GET(req: NextRequest) {
  const base = baseUrl(req);
  return NextResponse.json(
    {
      resource: `${base}${MCP_PATH}`,
      authorization_servers: [base],
    },
    { headers: CORS_HEADERS },
  );
}

export function OPTIONS() {
  return corsPreflight();
}
