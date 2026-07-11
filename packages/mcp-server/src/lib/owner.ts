import { getSupabase } from "./supabase.js";

// De MCP server draait met de service key en heeft dus geen auth-sessie.
// Sinds de multi-tenant hardening (fase 21) moeten inserts expliciet een
// user_id zetten (DEFAULT auth.uid() is NULL onder de service role — de rij
// zou voor niemand zichtbaar zijn). Resolutie: OWNER_USER_ID env var, met
// fallback naar de eerste app_settings rij (single-user opstelling).
let cached: string | null = null;

export async function getOwnerId(): Promise<string> {
  if (cached) return cached;
  const fromEnv = process.env.OWNER_USER_ID;
  if (fromEnv) {
    cached = fromEnv;
    return fromEnv;
  }
  const supabase = getSupabase();
  const { data } = await supabase
    .from("app_settings")
    .select("user_id")
    .limit(1)
    .maybeSingle();
  if (!data?.user_id) {
    throw new Error(
      "Geen OWNER_USER_ID bekend. Zet OWNER_USER_ID env var in claude_desktop_config.json.",
    );
  }
  cached = data.user_id;
  return cached;
}
