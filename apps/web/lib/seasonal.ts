// Seasonal prompts — triggerwoorden per maand die de eigenaar helpen
// herinneren aan items die op dit moment van het jaar goed verkopen op
// Marktplaats/Vinted/2dehands.

export type SeasonalPrompt = {
  category: string;
  examples: string[];
  rationale: string;
};

const MONTH_PROMPTS: Record<number, SeasonalPrompt[]> = {
  1: [ // januari
    { category: "Winter uitverkoop", examples: ["ski-spullen", "winterbanden", "winterjassen", "kerstverlichting"], rationale: "Eindseizoen: nu verkopen voordat vraag daalt" },
    { category: "Fitness / nieuwjaar", examples: ["home-trainer", "yogamat", "dumbbells", "fitnesstracker"], rationale: "Nieuwjaarsresoluties verhogen vraag naar fitness" },
  ],
  2: [
    { category: "Carnaval / feest", examples: ["verkleedkleding", "pruiken", "decoraties"], rationale: "Korte piek rond carnaval" },
    { category: "Valentijn", examples: ["cadeau-restanten", "sieraden", "parfum ongebruikt"], rationale: "Cadeau-markt actief" },
  ],
  3: [
    { category: "Lente opruiming", examples: ["winterspullen laatste kans", "tuinmeubelen", "barbecue onderhoud"], rationale: "Zolder-opruim-maand, BBQ-seizoen start" },
  ],
  4: [
    { category: "Tuin + outdoor", examples: ["tuinmeubel", "barbecue", "kamperen", "tuinkist"], rationale: "Tuinseizoen gestart — vraag stijgt" },
    { category: "Paaseieren / kinderen", examples: ["kinderspeelgoed", "buitenspeelgoed"], rationale: "Paasvakantie, ouders zoeken activiteiten" },
  ],
  5: [
    { category: "Kamperen / festival", examples: ["tent", "slaapzak", "campinggasstel", "festivalstoel"], rationale: "Festival-seizoen begint" },
    { category: "Meivakantie", examples: ["koffer", "reisadapter", "reisgids", "ruitermateriaal"], rationale: "Reis-voorbereiding" },
  ],
  6: [
    { category: "Zomer outdoor", examples: ["zwembad", "waterpistool", "ventilator", "zonnebrand"], rationale: "Hittegolf-maand" },
  ],
  7: [
    { category: "Vakantie-uitrusting", examples: ["koffer", "reiskrat", "fotocamera", "snorkel"], rationale: "Zomervakantie piek" },
  ],
  8: [
    { category: "Terug-naar-school", examples: ["schooltassen", "laptops", "studieboeken", "bureaus"], rationale: "Studenten-markt actief" },
  ],
  9: [
    { category: "Winter-vroegboek", examples: ["ski-schoenen", "wintersport kleding"], rationale: "Early bird ski-seizoen" },
    { category: "Zolder na zomer", examples: ["camping na-seizoen", "tuin opruiming"], rationale: "Eind zomer na-vakantie opruim" },
  ],
  10: [
    { category: "Halloween", examples: ["kostuums", "decoratie"], rationale: "Korte piek eind oktober" },
    { category: "Winter-voorbereiding", examples: ["winterbanden", "verwarming", "dekens"], rationale: "Winter begint" },
  ],
  11: [
    { category: "Sinterklaas / Black Friday", examples: ["cadeau-voorraad", "speelgoed", "elektronica"], rationale: "Cadeau-seizoen + BF-vraag" },
    { category: "Wintersport uitverkoop", examples: ["ski-pakken", "snowboards"], rationale: "Piek-vraag wintersport" },
  ],
  12: [
    { category: "Kerst / eindejaar", examples: ["kerstversiering", "kerstboom-voet", "cadeau-restanten"], rationale: "Kerst-piek + eindejaar-opruim" },
    { category: "Oud-en-nieuw", examples: ["vuurwerkbrillen", "party-spullen"], rationale: "Jaarwisseling markt" },
  ],
};

export function getSeasonalPromptsForDate(date: Date = new Date()): SeasonalPrompt[] {
  const month = date.getMonth() + 1;
  return MONTH_PROMPTS[month] ?? [];
}

export function getCurrentMonthLabel(date: Date = new Date()): string {
  return date.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
}
