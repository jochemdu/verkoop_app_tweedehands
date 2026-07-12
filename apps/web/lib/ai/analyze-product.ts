import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { PRODUCT_CONDITIONS, sanitizeForLLM } from "@verkoopassistent/shared";

// Vision-analyse van productfoto's → gestructureerd resultaat dat direct in
// de products/listings tabellen past. Draait volledig server-side; de client
// ziet alleen het eindresultaat via de API route.

export const DEFAULT_MODEL = "claude-opus-4-8";

// Advertentietaal: de gebruiker kiest waarin titel/verkooptekst geschreven
// worden (profiel-instelling, met per-aanroep override).
export const LISTING_LANGUAGES: Record<string, string> = {
  nl: "Nederlands",
  en: "Engels",
  de: "Duits",
  fr: "Frans",
};

// Categorieën zijn data (fase 22): de aanroeper geeft de actuele sluglijst
// mee zodat het model alleen bestaande categorieën kan kiezen.
export function buildAnalysisSchema(categorySlugs: readonly string[]) {
  const slugs = (categorySlugs.length > 0 ? categorySlugs : ["unknown"]) as [
    string,
    ...string[],
  ];
  return z.object({
  identified: z
    .boolean()
    .describe("Of het product met redelijke zekerheid herkend is."),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Hoe zeker de identificatie is."),
  title: z
    .string()
    .describe(
      "Korte advertentietitel (max 60 tekens) in de gevraagde advertentietaal, zoals kopers zoeken. Merk + model + kernspec.",
    ),
  description: z
    .string()
    .describe(
      "Aantrekkelijke verkooptekst in de gevraagde advertentietaal: 2-4 korte alinea's. Eerlijk over staat/gebreken, noem specs, eindig met ophaal/verzend-zin. Geen emoji-spam.",
    ),
  category_slug: z
    .enum(slugs)
    .describe("Best passende categorie uit de lijst."),
  condition: z
    .enum(PRODUCT_CONDITIONS)
    .describe("Conditie zoals zichtbaar op de foto's."),
  // Key-value paren i.p.v. z.record: structured outputs vereisen
  // additionalProperties:false, wat een record-schema niet kan garanderen.
  specs: z
    .array(
      z.object({
        key: z.string().describe("Spec-naam, bijv. brand/model/capacity/size/color/material"),
        value: z.string(),
      }),
    )
    .describe("Zichtbare/afleidbare specificaties."),
  defects: z
    .array(z.string())
    .describe("Zichtbare gebreken/schade, leeg als niets zichtbaar."),
  estimated_value_min: z
    .number()
    .describe("Ondergrens realistische tweedehands opbrengst in EUR."),
  estimated_value_max: z
    .number()
    .describe("Bovengrens realistische tweedehands opbrengst in EUR."),
  recommended_price: z
    .number()
    .describe("Aanbevolen vraagprijs in EUR (iets boven verwachte opbrengst)."),
  price_reasoning: z
    .string()
    .describe("Eén zin: waarop de prijsschatting gebaseerd is."),
  search_keywords: z
    .array(z.string())
    .describe("3-6 zoektermen om vraagprijzen op Marktplaats/Tweakers te checken."),
  photo_advice: z
    .array(z.string())
    .describe(
      "0-4 concrete NL fototips voor een betere advertentie (bijv. 'maak een detailfoto van het typeplaatje', 'fotografeer de beschadiging linksonder'). Leeg als de set compleet is.",
    ),
  });
}

export type ProductAnalysis = z.infer<ReturnType<typeof buildAnalysisSchema>>;

const SYSTEM_PROMPT = `Je bent een tweedehands-verkoopexpert voor de Nederlandse/Belgische markt. Je analyseert productfoto's voor een persoonlijke inventaris-app en levert een advertentie-klare analyse.

Richtlijnen:
- Identificeer het product zo precies mogelijk (merk, model, variant) op basis van wat zichtbaar is. Gok niet: als je het niet zeker weet, zeg dat via confidence en beschrijf wat je wél ziet.
- Prijzen zijn realistische NL tweedehands-marktprijzen (Marktplaats/Tweakers V&A niveau), niet nieuwprijzen.
- De beschrijving is direct bruikbaar als advertentie: vlot, eerlijk, concreet. Vermeld zichtbare gebreken expliciet — dat voorkomt gedoe achteraf.
- Let op stickers met een 4-cijferig nummer: dat is een interne inventarissticker, negeer die voor de identificatie en noem hem niet in de advertentie.
- Notities van de eigenaar kunnen context geven (bijv. "werkt niet") — weeg die mee in conditie en prijs.
- Schrijf title en description in de advertentietaal die in het bericht wordt gevraagd; alle andere velden (specs-keys, defects) in het Nederlands.`;

export type AnalyzeInput = {
  workingTitle: string | null;
  indexingNotes: string | null;
  ean: string | null;
  stickerId: string | null;
  photoUrls: string[];
  categorySlugs: readonly string[];
  // ISO-taalcode voor titel/verkooptekst (nl/en/de/fr). Default nl.
  listingLanguage?: string;
};

export async function analyzeProductPhotos(
  input: AnalyzeInput,
  model: string = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
): Promise<{ analysis: ProductAnalysis; model: string; usage: unknown }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY ontbreekt. Zet hem in apps/web/.env.local (en op Vercel).",
    );
  }
  if (input.photoUrls.length === 0) {
    throw new Error("Product heeft geen foto's om te analyseren.");
  }

  const client = new Anthropic();

  const language = LISTING_LANGUAGES[input.listingLanguage ?? "nl"] ?? "Nederlands";
  const contextLines = [
    `Advertentietaal voor titel en beschrijving: ${language}.`,
    input.workingTitle && `Werktitel van eigenaar: ${sanitizeForLLM(input.workingTitle)}`,
    input.indexingNotes && `Notities van eigenaar: ${sanitizeForLLM(input.indexingNotes)}`,
    input.ean && `Gescande EAN/barcode: ${input.ean}`,
    input.stickerId && `Interne sticker-ID (negeren in advertentie): ${input.stickerId}`,
  ].filter((l): l is string => Boolean(l));

  const response = await client.messages.parse({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(buildAnalysisSchema(input.categorySlugs)) },
    messages: [
      {
        role: "user",
        content: [
          ...input.photoUrls.map(
            (url) =>
              ({
                type: "image",
                source: { type: "url", url },
              }) as const,
          ),
          {
            type: "text",
            text: [
              "Analyseer dit tweedehands product op basis van de foto's.",
              ...contextLines,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Analyse geweigerd door het model (safety).");
  }
  const analysis = response.parsed_output;
  if (!analysis) {
    throw new Error("Model gaf geen geldig gestructureerd resultaat terug.");
  }
  return { analysis, model: response.model, usage: response.usage };
}
