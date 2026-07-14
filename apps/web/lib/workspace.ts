import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@verkoopassistent/shared";

// Fase 48: de actieve workspace van de ingelogde gebruiker. Data-inserts vullen
// workspace_id automatisch via een DB-trigger; deze helper is voor plekken die
// expliciet op de actieve workspace moeten filteren (bv. de gedeelde
// sticker-teller in app_settings, dat één rij per workspace is).
export async function getActiveWorkspaceId(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .maybeSingle();
  return data?.active_workspace_id ?? null;
}
