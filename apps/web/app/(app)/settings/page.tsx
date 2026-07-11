import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        <h1 className="text-3xl font-bold tracking-tight">Instellingen</h1>
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
    </main>
  );
}
