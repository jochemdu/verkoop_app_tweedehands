import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@verkoopassistent/shared";
import { serviceRoleKey, supabaseUrl } from "./config";

// Service-role client uitsluitend voor de OAuth-tabellen (interne state).
// De product-data wordt NOOIT via deze client benaderd — dat loopt altijd
// via de user-gescopte client (jwt.ts) zodat RLS de isolatie afdwingt.
let admin: SupabaseClient<Database> | null = null;
function db(): SupabaseClient<Database> {
  if (!admin) {
    admin = createClient<Database>(supabaseUrl(), serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/* ------------------------------- clients -------------------------------- */

export async function registerClient(
  clientId: string,
  clientName: string | null,
  redirectUris: string[],
): Promise<void> {
  const { error } = await db()
    .from("oauth_clients")
    .insert({ client_id: clientId, client_name: clientName, redirect_uris: redirectUris });
  if (error) throw new Error(error.message);
}

export async function getClient(
  clientId: string,
): Promise<{ redirect_uris: string[] } | null> {
  const { data } = await db()
    .from("oauth_clients")
    .select("redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  return data ?? null;
}

/* --------------------------- authorization codes ------------------------ */

export async function saveAuthCode(input: {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  ttlSeconds?: number;
}): Promise<void> {
  const expires = new Date(Date.now() + (input.ttlSeconds ?? 600) * 1000);
  const { error } = await db().from("oauth_authorization_codes").insert({
    code_hash: sha256(input.code),
    client_id: input.clientId,
    user_id: input.userId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    scope: input.scope,
    expires_at: expires.toISOString(),
  });
  if (error) throw new Error(error.message);
}

export type AuthCodeRow = {
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string | null;
  expires_at: string;
};

// Haalt de code op en verwijdert hem meteen (single-use).
export async function consumeAuthCode(code: string): Promise<AuthCodeRow | null> {
  const hash = sha256(code);
  const { data } = await db()
    .from("oauth_authorization_codes")
    .select("client_id, user_id, redirect_uri, code_challenge, scope, expires_at")
    .eq("code_hash", hash)
    .maybeSingle();
  await db().from("oauth_authorization_codes").delete().eq("code_hash", hash);
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

/* -------------------------------- tokens -------------------------------- */

export async function issueTokens(input: {
  clientId: string;
  userId: string;
  scope: string;
  accessTtlSeconds?: number;
  refreshTtlSeconds?: number;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const accessTtl = input.accessTtlSeconds ?? 3600;
  const refreshTtl = input.refreshTtlSeconds ?? 60 * 60 * 24 * 30;
  const { error } = await db().from("oauth_access_tokens").insert({
    token_hash: sha256(accessToken),
    refresh_token_hash: sha256(refreshToken),
    client_id: input.clientId,
    user_id: input.userId,
    scope: input.scope,
    expires_at: new Date(Date.now() + accessTtl * 1000).toISOString(),
    refresh_expires_at: new Date(Date.now() + refreshTtl * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return { accessToken, refreshToken, expiresIn: accessTtl };
}

// Valideert een access token → user_id (of null als ongeldig/verlopen).
export async function lookupAccessToken(
  token: string,
): Promise<{ userId: string; scope: string | null } | null> {
  const { data } = await db()
    .from("oauth_access_tokens")
    .select("user_id, scope, expires_at")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return { userId: data.user_id, scope: data.scope };
}

// Wisselt een refresh token om voor een nieuw access/refresh-paar (rotatie).
export async function rotateRefreshToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  const hash = sha256(refreshToken);
  const { data } = await db()
    .from("oauth_access_tokens")
    .select("client_id, user_id, scope, refresh_expires_at")
    .eq("refresh_token_hash", hash)
    .maybeSingle();
  if (!data) return null;
  if (data.refresh_expires_at && new Date(data.refresh_expires_at).getTime() < Date.now())
    return null;
  await db().from("oauth_access_tokens").delete().eq("refresh_token_hash", hash);
  return issueTokens({
    clientId: data.client_id,
    userId: data.user_id,
    scope: data.scope ?? "mcp",
  });
}
