import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";
import { LinkedAccounts, type Identity } from "./linked-accounts";
import { HouseholdSection } from "./household-section";
import { McpConnector } from "./mcp-connector";

export default async function SettingsPage() {
  const supabase = await createClient();
  const t = await getTranslations("settings");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Connect-URL van déze deploy afleiden uit de request, zodat preview én
  // productie elk hun eigen juiste MCP-URL tonen.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const mcpConnectUrl = host ? `${proto}://${host}/api/mcp` : "";

  const identities: Identity[] = (user?.identities ?? []).map((i) => ({
    identity_id: i.identity_id ?? i.id,
    provider: i.provider,
    email:
      (i.identity_data?.email as string | undefined) ?? user?.email ?? null,
  }));

  // Profiel bestaat via de signup-trigger; maybeSingle voor accounts van
  // vóór de backfill.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, display_language, listing_language")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>
      <SettingsForm
        userId={user!.id}
        profile={{
          display_name: profile?.display_name ?? "",
          display_language: profile?.display_language ?? "nl",
          listing_language: profile?.listing_language ?? "nl",
        }}
      />
      <HouseholdSection userId={user!.id} />
      {mcpConnectUrl && <McpConnector connectUrl={mcpConnectUrl} />}
      <LinkedAccounts identities={identities} />
    </main>
  );
}
