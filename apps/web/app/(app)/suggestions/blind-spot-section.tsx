"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
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

const FLAGS: Array<{ key: keyof Household; label: string }> = [
  { key: "kids", label: "Kinderen (nu of vroeger) in huis" },
  { key: "attic", label: "Zolder" },
  { key: "garage", label: "Garage of schuur" },
  { key: "garden", label: "Tuin" },
  { key: "recently_moved", label: "Recent verhuisd / samengewoond" },
  { key: "gamer", label: "Gamer (nu of vroeger)" },
  { key: "collector", label: "Verzamelaar" },
];

// Statische checklist-packs per huishoudkenmerk — direct bruikbaar zonder AI.
const PACKS: Partial<Record<keyof Household, string[]>> = {
  kids: [
    "Ontgroeide (merk)kleding per maat gebundeld",
    "Speelgoed: Lego, Playmobil, Duplo (per kilo of set)",
    "Kinderfietsen in 3 maten, loopfiets, autostoel",
    "Babyspullen: box, wipstoel, draagzak, buggy",
  ],
  attic: [
    "Dozen die sinds de vorige verhuizing dicht zitten",
    "Oude elektronica: routers, spelers, kabelbak",
    "Sport-restanten: ski's, tennisrackets, tassen",
    "Kerst/seizoensspullen in overvloed",
  ],
  garage: [
    "Dubbel gereedschap, oude boormachine",
    "Fietsonderdelen, kinderzitjes, fietsendrager",
    "Tuingereedschap dat je nooit gebruikt",
    "Autospullen: dakkoffer, sneeuwkettingen, velgen",
  ],
  garden: ["Tuinmeubels die vervangen zijn", "BBQ/heater die stof vangt", "Potten en plantenbakken"],
  recently_moved: ["Meubels die 'tijdelijk' opgeslagen staan", "Dubbele keukenspullen", "Gordijnen/lampen van het oude huis"],
  gamer: ["Oude consoles + games (retro loopt goed)", "Controllers, headsets, kabels", "Gaming-stoel of oude monitor"],
  collector: ["Dubbele exemplaren uit de verzameling", "Verzamelingen die je niet meer bijhoudt (kaarten, munten, LP's)"],
};

export function BlindSpotSection({
  userId,
  initialHousehold,
}: {
  userId: string;
  initialHousehold: Partial<Household> | null;
}) {
  const [household, setHousehold] = useState<Household>({
    ...DEFAULT_HOUSEHOLD,
    ...(initialHousehold ?? {}),
  });
  const [saving, setSaving] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [audit, setAudit] = useState<BlindSpotAudit | null>(null);

  const activePacks = FLAGS.filter((f) => household[f.key]).flatMap((f) =>
    (PACKS[f.key] ?? []).map((item) => ({ flag: f.label, item })),
  );

  async function saveHousehold() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, household });
      if (error) toast.error(`Opslaan mislukt: ${error.message}`);
      else toast.success("Huishoudprofiel opgeslagen");
    } finally {
      setSaving(false);
    }
  }

  async function runAudit() {
    setAuditing(true);
    const t = toast.loading("AI zoekt blinde vlekken… (kan ~1 min duren)");
    try {
      const res = await fetch("/api/suggestions/audit", { method: "POST" });
      const json = (await res.json()) as { audit?: BlindSpotAudit; error?: string };
      toast.dismiss(t);
      if (!res.ok || !json.audit) {
        toast.error(json.error ?? "Audit mislukt");
        return;
      }
      setAudit(json.audit);
    } finally {
      toast.dismiss(t);
      setAuditing(false);
    }
  }

  return (
    <>
      <section className="card space-y-3 p-5">
        <h2 className="section-title">
          Huishoudprofiel
        </h2>
        <p className="text-xs text-muted-foreground">
          Hoe meer de AI over je huis weet, hoe gerichter de blinde-vlekken-audit.
        </p>
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
              {f.label}
            </label>
          ))}
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">
            (Ex-)hobbies, bijv. fotografie, modelbouw, muziek…
          </span>
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
            {saving ? "Opslaan…" : "Profiel opslaan"}
          </button>
          <button
            type="button"
            onClick={runAudit}
            disabled={auditing}
            className="btn btn-accent"
          >
            {auditing ? "AI bezig…" : (<><Sparkles className="size-4" aria-hidden />AI blinde-vlekken-audit</>)}
          </button>
        </div>

        {activePacks.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="section-title mb-2">
              Checklist op basis van je profiel
            </p>
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
          <h2 className="section-title">
            AI-audit: waarschijnlijk nog in huis
          </h2>
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
                  <span className="font-medium">Zoek naar:</span> {s.examples.join(", ")}
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
