"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { BlindSpotAudit } from "@/lib/ai/blind-spots";
import { MapPin, Sparkles, Square } from "lucide-react";

type Household = {
  kids: boolean;
  attic: boolean;
  garage: boolean;
  garden: boolean;
  recently_moved: boolean;
  gamer: boolean;
  collector: boolean;
  hobbies: string;
};

const DEFAULT_HOUSEHOLD: Household = {
  kids: false,
  attic: false,
  garage: false,
  garden: false,
  recently_moved: false,
  gamer: false,
  collector: false,
  hobbies: "",
};

// Koppelt elk huishoudkenmerk aan zijn label-sleutel en checklist-pack in de
// i18n-catalog (suggestions.flag* / suggestions.pack*).
const FLAGS: Array<{
  key: keyof Household;
  labelKey: string;
  packKey: string;
}> = [
  { key: "kids", labelKey: "flagKids", packKey: "packKids" },
  { key: "attic", labelKey: "flagAttic", packKey: "packAttic" },
  { key: "garage", labelKey: "flagGarage", packKey: "packGarage" },
  { key: "garden", labelKey: "flagGarden", packKey: "packGarden" },
  { key: "recently_moved", labelKey: "flagMoved", packKey: "packMoved" },
  { key: "gamer", labelKey: "flagGamer", packKey: "packGamer" },
  { key: "collector", labelKey: "flagCollector", packKey: "packCollector" },
];

export function BlindSpotSection({
  userId,
  initialHousehold,
}: {
  userId: string;
  initialHousehold: Partial<Household> | null;
}) {
  const t = useTranslations("suggestions");
  const [household, setHousehold] = useState<Household>({
    ...DEFAULT_HOUSEHOLD,
    ...(initialHousehold ?? {}),
  });
  const [saving, setSaving] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [audit, setAudit] = useState<BlindSpotAudit | null>(null);

  const activePacks = FLAGS.filter((f) => household[f.key]).flatMap((f) => {
    const items = t.raw(f.packKey) as string[];
    return items.map((item) => ({ flag: t(f.labelKey), item }));
  });

  async function saveHousehold() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, household });
      if (error) toast.error(t("saveFailed", { msg: error.message }));
      else toast.success(t("profileSaved"));
    } finally {
      setSaving(false);
    }
  }

  async function runAudit() {
    setAuditing(true);
    const tid = toast.loading(t("auditLoading"));
    try {
      const res = await fetch("/api/suggestions/audit", { method: "POST" });
      const json = (await res.json()) as { audit?: BlindSpotAudit; error?: string };
      toast.dismiss(tid);
      if (!res.ok || !json.audit) {
        toast.error(json.error ?? t("auditFailed"));
        return;
      }
      setAudit(json.audit);
    } finally {
      toast.dismiss(tid);
      setAuditing(false);
    }
  }

  return (
    <>
      <section className="card space-y-3 p-5">
        <h2 className="section-title">{t("householdTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("householdIntro")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {FLAGS.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={Boolean(household[f.key])}
                onChange={(e) =>
                  setHousehold({ ...household, [f.key]: e.target.checked })
                }
              />
              {t(f.labelKey)}
            </label>
          ))}
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">{t("hobbiesLabel")}</span>
          <input
            value={household.hobbies}
            onChange={(e) => setHousehold({ ...household, hobbies: e.target.value })}
            className="input"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveHousehold}
            disabled={saving}
            className="btn btn-outline"
          >
            {saving ? t("savingProfile") : t("saveProfile")}
          </button>
          <button
            type="button"
            onClick={runAudit}
            disabled={auditing}
            className="btn btn-accent"
          >
            {auditing ? t("aiBusy") : (<><Sparkles className="size-4" aria-hidden />{t("aiAudit")}</>)}
          </button>
        </div>

        {activePacks.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="section-title mb-2">{t("checklistTitle")}</p>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {activePacks.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <Square className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    {p.item}
                    <span className="text-xs text-muted-foreground"> · {p.flag}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {audit && (
        <section className="card space-y-3 p-5">
          <h2 className="section-title">{t("aiAuditTitle")}</h2>
          <p className="text-sm italic text-muted-foreground">{audit.general_tip}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {audit.suggestions.map((s, i) => (
              <li key={i} className="space-y-1 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{s.title}</p>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {s.estimated_value}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{s.reasoning}</p>
                <p className="text-xs">
                  <span className="font-medium">{t("seekLabel")}</span> {s.examples.join(", ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  <MapPin className="inline size-3" aria-hidden /> {s.where_to_look} ·{" "}
                  <Link
                    href={`/inventory?category=${s.category_slug}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {s.category_slug}
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
