"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const router = useRouter();
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [form, setForm] = useState<Profile>(profile);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, ...form });
      if (error) {
        toast.error(t("saveFailed", { msg: error.message }));
        return;
      }
      // Weergavetaal meteen toepassen: cookie zetten (next-intl leest die)
      // en de server-componenten opnieuw renderen.
      document.cookie = `locale=${form.display_language}; path=/; max-age=31536000; samesite=lax`;
      toast.success(tc("saved"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-6">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{t("displayName")}</span>
        <input
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          placeholder={t("displayNamePlaceholder")}
          className="input"
        />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("displayLanguage")}</span>
          <select
            value={form.display_language}
            onChange={(e) => setForm({ ...form, display_language: e.target.value })}
            className="input"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <span className="block text-xs text-muted-foreground">{t("displayLanguageHelp")}</span>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("listingLanguage")}</span>
          <select
            value={form.listing_language}
            onChange={(e) => setForm({ ...form, listing_language: e.target.value })}
            className="input"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <span className="block text-xs text-muted-foreground">{t("listingLanguageHelp")}</span>
        </label>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="btn btn-accent"
      >
        {busy ? tc("saving") : tc("save")}
      </button>
    </div>
  );
}
