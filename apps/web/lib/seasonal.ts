// Seasonal prompts — triggerwoorden per maand die de eigenaar helpen
// herinneren aan items die op dit moment van het jaar goed verkopen op
// Marktplaats/Vinted/2dehands. De teksten zelf staan in de i18n-catalogs
// (suggestions.season.m1..m12); hier bepalen we alleen de huidige maand.

export type SeasonalPrompt = {
  category: string;
  examples: string[];
  rationale: string;
};

export function getCurrentMonth(date: Date = new Date()): number {
  return date.getMonth() + 1;
}

export function getMonthLabel(
  locale: string,
  date: Date = new Date(),
): string {
  return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
}
