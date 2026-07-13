import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BlindSpotSection } from "./blind-spot-section";
import { RoomAuditSection } from "./room-audit-section";
import { CATEGORY_SLUGS } from "@verkoopassistent/shared";
import { getCurrentMonth, getMonthLabel, type SeasonalPrompt } from "@/lib/seasonal";

// Verwachte typische inventaris-samenstelling. Laag getal = "minstens X items in
// een gemiddeld NL huishouden" — een 0 betekent dat die categorie nog niet
// geïndexeerd is en waarschijnlijk items bevat. Baselines zijn heuristisch. De
// voorbeeld-teksten staan in de i18n-catalog (suggestions.blExamples.<slug>).
const CATEGORY_BASELINE: Record<string, number> = {
  ram_dimm: 0,
  ram_sodimm: 0,
  cpu: 0,
  gpu: 0,
  console: 1,
  console_game: 5,
  smartphone: 2,
  laptop: 1,
  pokemon_card: 0,
  antique_tin: 0,
  antique_silver: 0,
  antique_other: 0,
  electronics_other: 3,
  unknown: 0,
  other: 0,
};

// Extra categorieën die NIET in de enum zitten maar waarschijnlijk items
// aanwezig zijn in een gemiddeld huishouden. Feat 12 — blinde vlekken. Naam +
// voorbeelden staan in de i18n-catalog (suggestions.missing.<slug>).
const MISSING_CATEGORIES: Array<{ slug: string; minimum: number }> = [
  { slug: "books", minimum: 20 },
  { slug: "vinyl_music", minimum: 10 },
  { slug: "clothing", minimum: 30 },
  { slug: "kitchenware", minimum: 10 },
  { slug: "tools", minimum: 5 },
  { slug: "toys", minimum: 10 },
  { slug: "board_games", minimum: 5 },
  { slug: "handbags", minimum: 3 },
  { slug: "shoes", minimum: 5 },
  { slug: "garden", minimum: 5 },
  { slug: "furniture", minimum: 2 },
];

export default async function SuggestionsPage() {
  const supabase = await createClient();
  const t = await getTranslations("suggestions");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("household")
    .eq("id", user!.id)
    .maybeSingle();

  // Count per category_slug.
  const { data: rows } = await supabase
    .from("products")
    .select("category_slug")
    .is("deleted_at", null);

  const counts = new Map<string, number>();
  (rows ?? []).forEach((r) => {
    const k = r.category_slug ?? "unknown";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });

  const blindSpotsInEnum = CATEGORY_SLUGS.filter((slug) => {
    const minimum = CATEGORY_BASELINE[slug];
    if (!minimum || minimum === 0) return false;
    return (counts.get(slug) ?? 0) === 0;
  });

  const month = getCurrentMonth();
  const monthLabel = getMonthLabel(await getLocaleTag());
  const seasonal = t.raw(`season.m${month}`) as SeasonalPrompt[] | undefined;

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
      </div>

      <RoomAuditSection userId={user!.id} />

      <BlindSpotSection
        userId={user!.id}
        initialHousehold={
          (profile?.household as Record<string, never> | null) ?? null
        }
      />

      {/* Seasonal */}
      {seasonal && seasonal.length > 0 && (
        <section className="card p-5 space-y-4">
          <div>
            <h2 className="section-title">{t("seasonTitle", { month: monthLabel })}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("seasonSubtitle")}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {seasonal.map((p, i) => (
              <li key={i} className="rounded-md bg-muted/40 p-3">
                <p className="text-sm font-medium">{p.category}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.rationale}</p>
                <p className="mt-2 text-xs">
                  {t("examplesLabel")}{" "}
                  <span className="font-mono text-muted-foreground">
                    {p.examples.join(", ")}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Blind spots in enum (indexeer meer in bestaande categorieën) */}
      {blindSpotsInEnum.length > 0 && (
        <section className="rounded-xl border border-warning bg-warning-soft p-5 space-y-3">
          <h2 className="section-title text-warning">{t("blindSpotsTitle")}</h2>
          <p className="text-xs text-warning">{t("blindSpotsSubtitle")}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {blindSpotsInEnum.map((slug) => (
              <li key={slug} className="rounded-lg border border-border bg-card p-3">
                <p className="text-sm font-medium font-mono">{slug}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("baseline", {
                    min: CATEGORY_BASELINE[slug]!,
                    examples: t(`blExamples.${slug}`),
                  })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Categorieën die niet in de enum zitten — suggesties om toe te voegen */}
      <section className="card p-5 space-y-3">
        <h2 className="section-title">{t("missingTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("missingSubtitle")}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {MISSING_CATEGORIES.map((cat) => (
            <li key={cat.slug} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{t(`missing.${cat.slug}.name`)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("expected", {
                  min: cat.minimum,
                  examples: t(`missing.${cat.slug}.examples`),
                })}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-3">
        <Link href="/upload" className="btn btn-accent">
          {t("startBulk")}
        </Link>
        <Link href="/inventory" className="btn btn-outline">
          {t("backToInventory")}
        </Link>
      </div>
    </main>
  );
}

async function getLocaleTag(): Promise<string> {
  const { getLocale } = await import("next-intl/server");
  const locale = await getLocale();
  const TAGS: Record<string, string> = {
    nl: "nl-NL",
    en: "en-GB",
    de: "de-DE",
    fr: "fr-FR",
  };
  return TAGS[locale] ?? "nl-NL";
}
