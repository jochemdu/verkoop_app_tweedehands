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

// Fase 48: inserts moeten ook workspace_id zetten (NOT NULL; auto-fill trigger
// werkt niet onder de service role). Resolvet de actieve workspace van de owner.
let cachedWs: string | null = null;

export async function getOwnerWorkspaceId(): Promise<string> {
  if (cachedWs) return cachedWs;
  const supabase = getSupabase();
  const ownerId = await getOwnerId();
  const { data: prof } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", ownerId)
    .maybeSingle();
  let ws = prof?.active_workspace_id ?? null;
  if (!ws) {
    const { data: m } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", ownerId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    ws = m?.workspace_id ?? null;
  }
  if (!ws) throw new Error("Geen workspace voor owner gevonden.");
  cachedWs = ws;
  return cachedWs;
}
