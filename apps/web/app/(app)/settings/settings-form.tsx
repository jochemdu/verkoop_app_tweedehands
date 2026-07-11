"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

// Talen voor advertentieteksten (AI-pipeline) en straks UI-vertaling.
export const LANGUAGES = [
  { code: "nl", label: "Nederlands" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
] as const;

type Profile = {
  display_name: string;
  display_language: string;
  listing_language: string;
};

export function SettingsForm({
  userId,
  profile,
}: {
  userId: string;
  profile: Profile;
}) {
  const [form, setForm] = useState<Profile>(profile);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, ...form });
      if (error) toast.error(`Opslaan mislukt: ${error.message}`);
      else toast.success("Instellingen opgeslagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border p-6">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Weergavenaam</span>
        <input
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          placeholder="Bijv. Jochem"
          className="w-full rounded-md border px-3 py-2 text-sm shadow-sm"
        />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Weergavetaal (app)</span>
          <select
            value={form.display_language}
            onChange={(e) => setForm({ ...form, display_language: e.target.value })}
            className="w-full rounded-md border px-3 py-2 text-sm shadow-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <span className="block text-xs text-muted-foreground">
            UI-vertaling volgt in een latere fase; deze voorkeur wordt alvast
            opgeslagen.
          </span>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Advertentietaal (AI)</span>
          <select
            value={form.listing_language}
            onChange={(e) => setForm({ ...form, listing_language: e.target.value })}
            className="w-full rounded-md border px-3 py-2 text-sm shadow-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <span className="block text-xs text-muted-foreground">
            De AI schrijft titels en verkoopteksten in deze taal.
          </span>
        </label>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Opslaan…" : "Opslaan"}
      </button>
    </div>
  );
}
