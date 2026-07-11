import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BlindSpotSection } from "./blind-spot-section";
import { CATEGORY_SLUGS } from "@verkoopassistent/shared";
import {
  getSeasonalPromptsForDate,
  getCurrentMonthLabel,
} from "@/lib/seasonal";

// Verwachte typische inventaris-samenstelling. Laag getal = "minstens X items in
// een gemiddeld NL huishouden" — een 0 betekent dat die categorie nog niet
// geïndexeerd is en waarschijnlijk items bevat. Baselines zijn heuristisch.
const CATEGORY_BASELINE: Record<string, { minimum: number; examples: string }> = {
  ram_dimm: { minimum: 0, examples: "— nichig, alleen relevant voor tech-liefhebbers" },
  ram_sodimm: { minimum: 0, examples: "— laptop-RAM, optioneel" },
  cpu: { minimum: 0, examples: "— nichig" },
  gpu: { minimum: 0, examples: "— gamer-restanten" },
  console: { minimum: 1, examples: "PlayStation, Xbox, Wii, Nintendo handhelds" },
  console_game: { minimum: 5, examples: "oude games die je nooit meer speelt" },
  smartphone: { minimum: 2, examples: "oude telefoons in een lade" },
  laptop: { minimum: 1, examples: "oude werk/school-laptop" },
  pokemon_card: { minimum: 0, examples: "— nichig, maar waardevol als je het hebt" },
  antique_tin: { minimum: 0, examples: "— zolder-waar, taxatie kan lonen" },
  antique_silver: { minimum: 0, examples: "— erfstukken" },
  antique_other: { minimum: 0, examples: "— diverse oude spullen" },
  electronics_other: { minimum: 3, examples: "adapters, kabels, oude routers, speakers" },
  unknown: { minimum: 0, examples: "— geen target" },
  other: { minimum: 0, examples: "— vrije categorie" },
};

// Extra categorieën die NIET in de enum zitten maar waarschijnlijk items
// aanwezig zijn in een gemiddeld huishouden. Feat 12 — blinde vlekken.
const MISSING_CATEGORIES = [
  { slug: "books", name: "Boeken", examples: "Boekenkast: paperbacks, non-fictie, kinderboeken. ISBN-scan gaat snel (Feat 19).", minimum: 20 },
  { slug: "vinyl_music", name: "LP's / muziek", examples: "Oude platen, CD's — niche markt met fans.", minimum: 10 },
  { slug: "clothing", name: "Kleding", examples: "Vinted-markt. Merk-kleding in goede staat.", minimum: 30 },
  { slug: "kitchenware", name: "Keukengerei", examples: "Ongebruikte pannen, Tupperware, kleine apparaten, servies.", minimum: 10 },
  { slug: "tools", name: "Gereedschap", examples: "Klussers-restanten, oude boor/zaag/meetgereedschap.", minimum: 5 },
  { slug: "toys", name: "Speelgoed", examples: "Lego, Playmobil, knuffels uit je jeugd — verzamelaars-markt.", minimum: 10 },
  { slug: "board_games", name: "Gezelschapsspellen", examples: "Spellen die stof vangen op zolder.", minimum: 5 },
  { slug: "handbags", name: "Tassen", examples: "Merktassen, leren tassen — Vinted/Marktplaats-markt.", minimum: 3 },
  { slug: "shoes", name: "Schoenen", examples: "Weinig gedragen (merk)schoenen, sneakers.", minimum: 5 },
  { slug: "garden", name: "Tuin", examples: "Oude tuinmeubels, gereedschap, potten.", minimum: 5 },
  { slug: "furniture", name: "Meubels", examples: "Meubels die je vervangen hebt maar nog staan.", minimum: 2 },
];

export default async function SuggestionsPage() {
  const supabase = await createClient();
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

  const blindSpotsInEnum = CATEGORY_SLUGS.filter(
    (slug) => {
      const baseline = CATEGORY_BASELINE[slug];
      if (!baseline || baseline.minimum === 0) return false;
      return (counts.get(slug) ?? 0) === 0;
    },
  );

  const seasonal = getSeasonalPromptsForDate();
  const monthLabel = getCurrentMonthLabel();

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Verkoop-suggesties</h1>
        <p className="text-sm text-muted-foreground">
          Gebaseerd op je inventaris + het huidige seizoen.
        </p>
      </div>

      <BlindSpotSection
        userId={user!.id}
        initialHousehold={
          (profile?.household as Record<string, never> | null) ?? null
        }
      />

      {/* Seasonal */}
      {seasonal.length > 0 && (
        <section className="rounded-lg border p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Seizoen — {monthLabel}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Items die nu beter verkopen door het seizoen. Check je huis op
              deze thema&apos;s.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {seasonal.map((p, i) => (
              <li key={i} className="rounded-md bg-muted/40 p-3">
                <p className="text-sm font-medium">{p.category}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.rationale}</p>
                <p className="mt-2 text-xs">
                  Voorbeelden:{" "}
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
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-5 space-y-3 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
            Blinde vlekken in bestaande categorieën
          </h2>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Deze categorieën hebben nog 0 items maar je hebt ze waarschijnlijk wel.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {blindSpotsInEnum.map((slug) => {
              const info = CATEGORY_BASELINE[slug]!;
              return (
                <li key={slug} className="rounded-md border border-amber-200 bg-white p-3 dark:bg-zinc-900 dark:border-amber-800/40">
                  <p className="text-sm font-medium font-mono">{slug}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Baseline: ≥{info.minimum} · {info.examples}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Categorieën die niet in de enum zitten — suggesties om toe te voegen */}
      <section className="rounded-lg border p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Mogelijk overgeslagen categorieën
        </h2>
        <p className="text-xs text-muted-foreground">
          Deze categorieën bestaan in het systeem maar zijn (bijna) leeg, terwijl
          ze waarschijnlijk wél in je huis staan. Pak er één en indexeer een batch.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {MISSING_CATEGORIES.map((cat) => (
            <li key={cat.slug} className="rounded-md border p-3">
              <p className="text-sm font-medium">{cat.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Verwacht: ≥{cat.minimum} items · {cat.examples}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-3">
        <Link
          href="/upload"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Start bulk-sessie
        </Link>
        <Link
          href="/inventory"
          className="rounded-md border px-4 py-2 text-sm"
        >
          Terug naar inventaris
        </Link>
      </div>
    </main>
  );
}
