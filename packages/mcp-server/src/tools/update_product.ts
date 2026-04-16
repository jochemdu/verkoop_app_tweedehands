import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  PRODUCT_CONDITIONS,
  PRODUCT_STATUSES,
  CATEGORY_SLUGS,
  type Database,
} from "@verkoopassistent/shared";
import { getSupabase } from "../lib/supabase";
import { resolveProductId } from "../lib/resolve";
import { jsonContent, errorContent } from "../lib/format";

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

const schema = z.object({
  product: z.string().min(1).describe("UUID of 4-cijferig sticker-ID."),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  category_slug: z.enum(CATEGORY_SLUGS).optional(),
  condition: z.enum(PRODUCT_CONDITIONS).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  specs: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Categorie-specifieke specs als JSON (bijv. { capacity_gb: 8, brand: 'Samsung' }). Komt in de JSONB 'specs' kolom.",
    ),
  defects: z.array(z.string()).optional(),
  included_accessories: z.array(z.string()).optional(),
  missing_items: z.array(z.string()).optional(),
  estimated_value_min: z.number().nonnegative().optional(),
  estimated_value_max: z.number().nonnegative().optional(),
  recommended_price: z.number().nonnegative().optional(),
  mark_analyzed: z
    .boolean()
    .optional()
    .describe(
      "Wanneer true, wordt `analyzed_at` op NOW() gezet om te markeren dat Claude dit product heeft geanalyseerd.",
    ),
});

export const updateProductDefinition = {
  name: "update_product",
  description:
    "Werk productgegevens bij. Gebruik deze om een 'unknown' product te categoriseren, conditie in te vullen, of na analyse de status naar ready_to_list te zetten. Velden die je niet meestuurt blijven ongewijzigd.",
  inputSchema: zodToJsonSchema(schema, { target: "openApi3" }),
};

export async function handleUpdateProduct(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`,
    );
  }
  const { product, specs, mark_analyzed, ...fields } = parsed.data;

  let productId: string;
  try {
    productId = await resolveProductId(product);
  } catch (err) {
    return errorContent(err instanceof Error ? err.message : "unknown");
  }

  // Bouw het update object: alleen velden meesturen die opgegeven zijn.
  // ProductUpdate type zorgt dat onbekende velden afgevangen worden.
  const update: ProductUpdate = {};
  if (fields.title !== undefined) update.title = fields.title;
  if (fields.description !== undefined) update.description = fields.description;
  if (fields.category_slug !== undefined)
    update.category_slug = fields.category_slug;
  if (fields.condition !== undefined) update.condition = fields.condition;
  if (fields.status !== undefined) update.status = fields.status;
  if (fields.defects !== undefined) update.defects = fields.defects;
  if (fields.included_accessories !== undefined)
    update.included_accessories = fields.included_accessories;
  if (fields.missing_items !== undefined)
    update.missing_items = fields.missing_items;
  if (fields.estimated_value_min !== undefined)
    update.estimated_value_min = fields.estimated_value_min;
  if (fields.estimated_value_max !== undefined)
    update.estimated_value_max = fields.estimated_value_max;
  if (fields.recommended_price !== undefined)
    update.recommended_price = fields.recommended_price;
  if (specs !== undefined) update.specs = specs as ProductUpdate["specs"];
  if (mark_analyzed) update.analyzed_at = new Date().toISOString();

  if (Object.keys(update).length === 0) {
    return errorContent("Geen velden opgegeven om te updaten.");
  }

  const supabase = getSupabase();
  const { data: updated, error } = await supabase
    .from("products")
    .update(update)
    .eq("id", productId)
    .select()
    .single();
  if (error || !updated) return errorContent(error?.message ?? "unknown");

  return jsonContent(
    { product_id: productId, updated_fields: Object.keys(update), product: updated },
    `Product ${productId} bijgewerkt (${Object.keys(update).length} veld(en)):`,
  );
}
