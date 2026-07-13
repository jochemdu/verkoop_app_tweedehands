import "server-only";
import { SignJWT } from "jose";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@verkoopassistent/shared";
import { anonKey, supabaseJwtSecret, supabaseUrl } from "./config";

// Mint een kortlevend Supabase user-JWT (HS256, getekend met het project
// JWT-secret) en geef een client terug die als díe gebruiker praat. Zo doet
// Postgres-RLS het isolatiewerk (auth.uid() = userId) en raken we nooit de
// service-role aan voor productdata — één centrale, veilige plek.
export async function userScopedClient(
  userId: string,
): Promise<SupabaseClient<Database>> {
  const secret = new TextEncoder().encode(supabaseJwtSecret());
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setAudience("authenticated")
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(secret);
  return createClient<Database>(supabaseUrl(), anonKey(), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
