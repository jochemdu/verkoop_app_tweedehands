import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getSupabase } from "../lib/supabase";
import { resolveProductIds } from "../lib/resolve";
import { jsonContent, errorContent } from "../lib/format";

const BUNDLE_TYPES = [
  "ram_kit",
  "console_bundle",
  "card_lot",
  "card_set",
  "hardware_bundle",
  "custom",
] as const;

const schema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  bundle_type: z.enum(BUNDLE_TYPES).default("custom"),
  product_ids_or_stickers: z
    .array(z.string().min(1))
    .min(2)
    .max(50)
    .describe("Mix van UUIDs en/of 4-cijferige sticker-ID's. Min 2, max 50."),
  suggested_price: z.number().nonnegative().optional(),
  reasoning: z
    .string()
    .min(10)
    .describe(
      "Waarom deze items samen een bundel vormen (bijv. 'matched DDR2 SODIMM kit, zelfde snelheid en merk'). Wordt opgeslagen zodat de gebruiker later kan reviewen.",
    ),
  confirm: z
    .boolean()
    .default(false)
    .describe(
      "Security: mutaties vereisen expliciete confirm=true. Zonder confirm krijg je een dry-run response met wat er zou gebeuren — vraag de gebruiker om bevestiging en roep dan opnieuw aan met confirm=true.",
    ),
});

export const suggestBundleDefinition = {
  name: "suggest_bundle",
  description:
    "Maak een voorstel voor een productbundel aan (status: ready_to_list). De gebruiker kan dit later goedkeuren. Je reasoning is verplicht zodat de gebruiker weet waarom je deze items voorstelt.",
  inputSchema: zodToJsonSchema(schema, { target: "openApi3" }),
};

export async function handleSuggestBundle(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`,
    );
  }
  const {
    title,
    description,
    bundle_type,
    product_ids_or_stickers,
    suggested_price,
    reasoning,
  } = parsed.data;

  const { resolved, missing } = await resolveProductIds(product_ids_or_stickers);
  if (missing.length > 0) {
    return errorContent(
      `Deze ID's zijn niet gevonden: ${missing.join(", ")}. Controleer sticker-ID's en probeer opnieuw.`,
    );
  }

  if (!parsed.data.confirm) {
    return jsonContent(
      {
        dry_run: true,
        would_create_bundle: {
          title,
          bundle_type,
          product_count: resolved.length,
          suggested_price: suggested_price ?? null,
          reasoning,
          status: "ready_to_list",
        },
        action_required:
          "Herhaal deze call met confirm=true om daadwerkelijk aan te maken. Vraag eerst aan de gebruiker of dit juist is.",
      },
      `DRY-RUN: bundel-voorstel nog niet opgeslagen.`,
    );
  }

  const supabase = getSupabase();

  // Bereken total_individual_value uit recommended_price van de items.
  const { data: priceRows } = await supabase
    .from("products")
    .select("id, recommended_price")
    .in("id", resolved);
  const totalValue =
    priceRows?.reduce((sum, p) => sum + (Number(p.recommended_price) || 0), 0) ??
    0;

  const { data: bundle, error: bundleErr } = await supabase
    .from("bundles")
    .insert({
      title,
      description: description ?? null,
      bundle_type,
      suggested_by: "claude_mcp",
      claude_reasoning: reasoning,
      total_individual_value: totalValue > 0 ? totalValue : null,
      suggested_price: suggested_price ?? null,
      status: "ready_to_list",
    })
    .select()
    .single();
  if (bundleErr || !bundle)
    return errorContent(bundleErr?.message ?? "bundle insert faalde");

  const bundleItems = resolved.map((product_id, i) => ({
    bundle_id: bundle.id,
    product_id,
    position: i,
  }));
  const { error: itemsErr } = await supabase
    .from("bundle_items")
    .insert(bundleItems);
  if (itemsErr) {
    // Best-effort rollback: verwijder bundle als item-inserts falen.
    await supabase.from("bundles").delete().eq("id", bundle.id);
    return errorContent(`bundle_items insert faalde: ${itemsErr.message}`);
  }

  return jsonContent(
    {
      bundle_id: bundle.id,
      title: bundle.title,
      bundle_type: bundle.bundle_type,
      product_count: resolved.length,
      total_individual_value: totalValue,
      suggested_price,
      status: bundle.status,
      reasoning,
    },
    `Bundle "${title}" aangemaakt met ${resolved.length} producten:`,
  );
}
