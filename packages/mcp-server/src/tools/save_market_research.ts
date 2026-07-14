import { z } from "zod";
import { sanitizeForLLM } from "@verkoopassistent/shared";
import { getSupabase } from "../lib/supabase.js";
import { resolveProductId } from "../lib/resolve.js";
import { errorContent, jsonContent } from "../lib/format.js";
import { getOwnerId, getOwnerWorkspaceId } from "../lib/owner.js";

const comparableSchema = z.object({
  source: z
    .string()
    .max(50)
    .describe("Waar gevonden: marktplaats / vinted / ebay / tweakers / webshop / anders."),
  url: z.string().url().max(500).optional().describe("Link naar de advertentie."),
  title: z.string().min(2).max(200).describe("Titel van de gevonden advertentie."),
  price: z.number().nonnegative().optional().describe("Prijs in EUR."),
  is_sold: z
    .boolean()
    .optional()
    .describe("true = daadwerkelijk verkocht (sterkste prijssignaal), false = vraagprijs."),
  condition: z.string().max(100).optional().describe("Staat volgens de advertentie."),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  description_snippet: z
    .string()
    .max(1000)
    .optional()
    .describe("Relevante zinnen uit de advertentietekst (goede formuleringen om te hergebruiken)."),
  notes: z
    .string()
    .max(500)
    .optional()
    .describe("Jouw duiding: waarom vergelijkbaar / verschillen (bijv. 'incl. 2 games')."),
});

const schema = z.object({
  product: z
    .string()
    .describe("UUID van een product OF 4-cijferig sticker-ID (bijv. '0042')."),
  comparables: z
    .array(comparableSchema)
    .min(1)
    .max(30)
    .describe("Gevonden vergelijkbare advertenties/producten."),
  price_advice: z
    .object({
      estimated_value_min: z.number().nonnegative(),
      estimated_value_max: z.number().nonnegative(),
      recommended_price: z.number().nonnegative(),
      reasoning: z.string().max(500).describe("Onderbouwing op basis van de comparables."),
    })
    .optional()
    .describe("Prijsadvies afgeleid uit het onderzoek; wordt op het product gezet."),
  apply_price_advice: z
    .boolean()
    .default(false)
    .describe("true = zet het prijsadvies ook daadwerkelijk op het product."),
});

export const saveMarketResearchDefinition = {
  name: "save_market_research",
  description:
    "Sla marktonderzoek op bij een product (fase 29): vergelijkbare advertenties (prijs, staat, model, kleur, tekstfragmenten) uit jouw web-zoektocht, plus optioneel prijsadvies. Workflow: get_product_context → zoek op web (Marktplaats/Vinted/eBay, filter op 'verkocht' waar mogelijk) → save_market_research → create_listing met een verkooptekst die de beste formuleringen en een marktconforme prijs gebruikt.",
  inputSchema: z.toJSONSchema(schema),
};

export async function handleSaveMarketResearch(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  let productId: string;
  try {
    productId = await resolveProductId(parsed.data.product);
  } catch (err) {
    return errorContent(err instanceof Error ? err.message : "unknown");
  }

  const supabase = getSupabase();
  const ownerId = await getOwnerId();
  const workspaceId = await getOwnerWorkspaceId();

  const rows = parsed.data.comparables.map((c) => ({
    product_id: productId,
    user_id: ownerId,
    workspace_id: workspaceId,
    source: sanitizeForLLM(c.source),
    url: c.url ?? null,
    title: sanitizeForLLM(c.title),
    price: c.price ?? null,
    is_sold: c.is_sold ?? null,
    condition: c.condition ? sanitizeForLLM(c.condition) : null,
    brand: c.brand ?? null,
    model: c.model ?? null,
    color: c.color ?? null,
    description_snippet: c.description_snippet
      ? sanitizeForLLM(c.description_snippet)
      : null,
    notes: c.notes ? sanitizeForLLM(c.notes) : null,
  }));

  const { error: insertErr } = await supabase.from("market_comparables").insert(rows);
  if (insertErr) return errorContent(`Opslaan mislukt: ${insertErr.message}`);

  let priceApplied = false;
  if (parsed.data.price_advice && parsed.data.apply_price_advice) {
    const a = parsed.data.price_advice;
    const { error: updateErr } = await supabase
      .from("products")
      .update({
        estimated_value_min: a.estimated_value_min,
        estimated_value_max: a.estimated_value_max,
        recommended_price: a.recommended_price,
      })
      .eq("id", productId);
    priceApplied = !updateErr;
  }

  await supabase.from("claude_analyses").insert({
    analysis_type: "market_research",
    claude_source: "mcp",
    user_prompt: `Marktonderzoek voor product ${parsed.data.product} (${rows.length} comparables)`,
    claude_response: {
      comparables: rows,
      price_advice: parsed.data.price_advice ?? null,
    } as never,
    subject_products: [productId],
    applied: priceApplied,
    user_id: ownerId,
    workspace_id: workspaceId,
  });

  return jsonContent(
    {
      saved: rows.length,
      price_advice_applied: priceApplied,
      price_advice: parsed.data.price_advice ?? null,
    },
    `${rows.length} comparables opgeslagen${priceApplied ? " + prijsadvies op product gezet" : ""}. Volgende stap: create_listing met een verkooptekst op basis van dit onderzoek.`,
  );
}
