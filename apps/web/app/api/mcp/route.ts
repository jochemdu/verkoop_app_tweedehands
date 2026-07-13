import { type NextRequest, NextResponse } from "next/server";
import { baseUrl } from "@/lib/mcp/config";
import { CORS_HEADERS, corsPreflight } from "@/lib/mcp/http";
import { lookupAccessToken } from "@/lib/mcp/store";
import { userScopedClient } from "@/lib/mcp/jwt";
import { callTool, toolDefinitions } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROTOCOL_VERSION = "2025-06-18";

type JsonRpcReq = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
};

function result(id: JsonRpcReq["id"], res: unknown) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, result: res },
    { headers: CORS_HEADERS },
  );
}
function rpcError(id: JsonRpcReq["id"], code: number, message: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { headers: CORS_HEADERS },
  );
}

// 401 met verwijzing naar de protected-resource metadata, zodat de client de
// OAuth-flow start (RFC 9728).
function unauthorized(req: NextRequest) {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer resource_metadata="${baseUrl(req)}/.well-known/oauth-protected-resource"`,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;
  if (!token) return unauthorized(req);
  const session = await lookupAccessToken(token);
  if (!session) return unauthorized(req);

  let body: JsonRpcReq;
  try {
    body = (await req.json()) as JsonRpcReq;
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const { method, id } = body;

  // Notificaties (geen id) vereisen geen resultaat.
  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  if (method === "initialize") {
    return result(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "verkoopassistent", version: "1.0.0" },
    });
  }

  if (method === "ping") {
    return result(id, {});
  }

  if (method === "tools/list") {
    return result(id, { tools: toolDefinitions() });
  }

  if (method === "tools/call") {
    const params = (body.params ?? {}) as { name?: string; arguments?: unknown };
    if (!params.name) return rpcError(id, -32602, "Tool-naam ontbreekt");
    try {
      const db = await userScopedClient(session.userId);
      const toolResult = await callTool(db, params.name, params.arguments);
      return result(id, toolResult);
    } catch (e) {
      return rpcError(id, -32603, e instanceof Error ? e.message : "interne fout");
    }
  }

  return rpcError(id, -32601, `Onbekende methode: ${method}`);
}

// Sommige clients doen een GET voor een SSE-stream; wij zijn stateless en
// bieden die niet aan → 405 (spec-conform).
export function GET() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: CORS_HEADERS,
  });
}

export function OPTIONS() {
  return corsPreflight();
}
