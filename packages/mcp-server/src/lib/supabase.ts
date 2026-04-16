import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@verkoopassistent/shared";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `MCP server mist environment variable: ${name}. Zet deze in claude_desktop_config.json of in packages/mcp-server/.env.`,
    );
  }
  return value;
}

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;
  const url = required("SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_KEY");
  client = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
