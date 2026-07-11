import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { DEFAULT_MODEL } from "./analyze-product";

// AI blinde-vlekken-audit: kijkt naar wat er WEL in de inventaris zit en
// naar het huishoudprofiel, en leidt daaruit af wat er waarschijnlijk in
// huis ligt maar nog niet geïndexeerd is.

export const blindSpotAuditSchema = z.object({
  suggestions: z
    .array(
      z.object({
        title: z.string().describe("Korte NL naam van de blinde vlek, bijv. 'Console-accessoires'"),
        reasoning: z
          .string()
          .describe("Eén-twee zinnen: waarom dit waarschijnlijk in huis ligt, gekoppeld aan de bestaande inventaris of het huishoudprofiel."),
        examples: z
          .array(z.string())
          .describe("3-6 concrete voorbeelditems om naar te zoeken."),
        category_slug: z
          .string()
          .describe("Best passende categorie-slug uit de meegegeven lijst, of 'other'."),
        where_to_look: z
          .string()
          .describe("Waar in huis dit meestal ligt (zolder, schuur, lade, kledingkast...)."),
        estimated_value: z
          .string()
          .describe("Grove NL tweedehands waarde-indicatie, bijv. '€20-80 totaal'."),
      }),
    )
    .describe("8-12 blinde vlekken, meest waardevolle eerst."),
  general_tip: z
    .string()
    .describe("Eén overkoepelende observatie over deze inventaris."),
});

export type BlindSpotAudit = z.infer<typeof blindSpotAuditSchema>;

const SYSTEM_PROMPT = `Je helpt een Nederlandse gebruiker die het huis opruimt en tweedehands spullen verkoopt. Op basis van wat al geïndexeerd is en het huishoudprofiel leid je af welke verkoopbare spullen er waarschijnlijk nog ONontdekt in huis liggen.

Richtlijnen:
- Redeneer vanuit correlaties: wie een spelcomputer heeft, heeft vaak ook games/controllers/kabels; wie kinderen heeft, heeft ontgroeide kleding/speelgoed/fietsjes in drie maten; een ex-hobby laat spullen achter.
- Wees concreet en NL-realistisch (Marktplaats/Vinted-waardig). Geen dingen die niets opbrengen.
- Noem niets dat al ruim in de inventaris zit — het gaat om wat er NIET in staat.
- Gebruik het huishoudprofiel zwaar: kinderen, zolder/schuur/tuin, verhuisd, gamer, verzamelaar, hobbies.`;

export type AuditInput = {
  categoryCounts: Array<{ slug: string; name: string; count: number }>;
  recentTitles: string[];
  household: Record<string, unknown>;
  categorySlugs: string[];
};

export async function runBlindSpotAudit(
  input: AuditInput,
  model: string = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
): Promise<{ audit: BlindSpotAudit; model: string; usage: unknown }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ontbreekt (zie apps/web/.env.local.example).");
  }
  const client = new Anthropic();

  const inventoryLines = input.categoryCounts
    .map((c) => `- ${c.name} (${c.slug}): ${c.count} items`)
    .join("\n");

  const response = await client.messages.parse({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(blindSpotAuditSchema) },
    messages: [
      {
        role: "user",
        content: [
          "## Huidige inventaris per categorie",
          inventoryLines || "(nog leeg)",
          "",
          "## Recente item-titels (steekproef)",
          input.recentTitles.length > 0 ? input.recentTitles.map((t) => `- ${t}`).join("\n") : "(geen)",
          "",
          "## Huishoudprofiel",
          JSON.stringify(input.household ?? {}, null, 1),
          "",
          "## Beschikbare categorie-slugs",
          input.categorySlugs.join(", "),
          "",
          "Welke verkoopbare spullen liggen hier waarschijnlijk nog onontdekt?",
        ].join("\n"),
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Audit geweigerd door het model.");
  }
  const audit = response.parsed_output;
  if (!audit) throw new Error("Model gaf geen geldig resultaat.");
  return { audit, model: response.model, usage: response.usage };
}
