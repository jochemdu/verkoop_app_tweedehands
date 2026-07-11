import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { DEFAULT_MODEL } from "./analyze-product";

// Room-audit (Feat 20 / fase-16 vervolg): foto('s) van een kamer → lijst
// verkoopbare items, gecross-referenced met wat al geïndexeerd is.

export function buildRoomAuditSchema(categorySlugs: readonly string[]) {
  const slugs = (categorySlugs.length > 0 ? categorySlugs : ["unknown"]) as [
    string,
    ...string[],
  ];
  return z.object({
    room_guess: z
      .string()
      .describe("Korte NL gok welk soort ruimte dit is (woonkamer, zolder, schuur...)."),
    items: z
      .array(
        z.object({
          name: z
            .string()
            .describe("Korte NL naam van het item zoals je het op Marktplaats zou zetten (merk indien leesbaar)."),
          category_slug: z.enum(slugs).describe("Best passende categorie."),
          estimated_value: z
            .string()
            .describe("Grove NL tweedehands waarde-indicatie, bijv. '€15-30'."),
          confidence: z
            .enum(["high", "medium", "low"])
            .describe("Hoe zeker de herkenning is."),
          probably_indexed: z
            .boolean()
            .describe("True als dit item waarschijnlijk al in de meegegeven inventarislijst staat."),
          location_hint: z
            .string()
            .describe("Waar in beeld het item staat (bijv. 'plank linksboven'), zodat de eigenaar het terugvindt."),
        }),
      )
      .describe("Alle duidelijk verkoopbare items in beeld, waardevolste eerst. Sla vaste inrichting en waardeloze spullen over."),
    summary: z.string().describe("Eén zin: totale indruk + geschatte totaalopbrengst."),
  });
}

export type RoomAudit = z.infer<ReturnType<typeof buildRoomAuditSchema>>;

const SYSTEM_PROMPT = `Je scant kamerfoto's voor een Nederlandse gebruiker die het huis opruimt en tweedehands verkoopt. Benoem alle los verkoopbare items die je ziet.

Richtlijnen:
- Alleen items die realistisch iets opbrengen op Marktplaats/Vinted (>€5). Geen vaste inrichting (radiatoren, vloeren), geen prullaria.
- Merk/model noemen als het leesbaar of herkenbaar is; anders een duidelijke soortnaam.
- Vergelijk met de meegegeven inventarislijst: markeer probably_indexed=true bij een waarschijnlijke match (zelfde soort item + merk), anders false.
- location_hint helpt de eigenaar het item fysiek terug te vinden.`;

export type RoomAuditInput = {
  photoUrls: string[];
  roomName: string | null;
  inventoryTitles: string[];
  categorySlugs: readonly string[];
};

export async function runRoomAudit(
  input: RoomAuditInput,
  model: string = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
): Promise<{ audit: RoomAudit; model: string; usage: unknown }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ontbreekt (zie apps/web/.env.local.example).");
  }
  if (input.photoUrls.length === 0) {
    throw new Error("Geen kamerfoto's meegegeven.");
  }
  const client = new Anthropic();

  const response = await client.messages.parse({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(buildRoomAuditSchema(input.categorySlugs)) },
    messages: [
      {
        role: "user",
        content: [
          ...input.photoUrls.map(
            (url) => ({ type: "image", source: { type: "url", url } }) as const,
          ),
          {
            type: "text",
            text: [
              input.roomName ? `Ruimte volgens de eigenaar: ${input.roomName}` : null,
              "## Al geïndexeerde items (voor de dubbel-check)",
              input.inventoryTitles.length > 0
                ? input.inventoryTitles.map((t) => `- ${t}`).join("\n")
                : "(nog niets geïndexeerd)",
              "",
              "Welke verkoopbare items zie je op deze foto('s)?",
            ]
              .filter((l): l is string => l !== null)
              .join("\n"),
          },
        ],
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
