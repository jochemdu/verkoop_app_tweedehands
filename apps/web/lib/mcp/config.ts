import "server-only";
import type { NextRequest } from "next/server";

// Server-only secrets voor de gehoste MCP (fase 34). Bewust NIET in de
// gedeelde env-schema zodat de app niet crasht als de MCP nog niet
// geconfigureerd is; we falen pas als een MCP-route echt aangeroepen wordt.
export function serviceRoleKey(): string {
  const v = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!v) throw new Error("SUPABASE_SERVICE_ROLE_KEY ontbreekt (Vercel env).");
  return v;
}

export function supabaseJwtSecret(): string {
  const v = process.env.SUPABASE_JWT_SECRET;
  if (!v) throw new Error("SUPABASE_JWT_SECRET ontbreekt (Vercel env).");
  return v;
}

export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_URL ontbreekt.");
  return v;
}

export function anonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY ontbreekt.");
  return v;
}

// Publieke basis-URL van deze deploy. We leiden hem af uit de request zodat
// preview- en productie-deploys elk hun eigen issuer krijgen (OAuth-metadata
// moet exact matchen met de host waarop de connector draait).
export function baseUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export const MCP_PATH = "/api/mcp";
