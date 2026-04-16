import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  PRODUCT_STATUSES,
  CATEGORY_SLUGS,
  stickerIdSchema,
} from "@verkoopassistent/shared";
import { getSupabase } from "../lib/supabase";
import { jsonContent, errorContent } from "../lib/format";

const schema = z.object({
  status: z.enum(PRODUCT_STATUSES).optional(),
  category: z.enum(CATEGORY_SLUGS).optional(),
  sticker_range_start: stickerIdSchema.optional(),
  sticker_range_end: stickerIdSchema.optional(),
  has_photos: z
    .boolean()
    .optional()
    .describe("Wanneer true, alleen producten met minstens 1 foto."),
  limit: z.number().int().min(1).max(200).default(50),
});

export const listInventoryDefinition = {
  name: "list_inventory",
  description:
    "Lijst producten uit de inventaris met filters. Returnt een samenvatting per product (sticker_id, werktitel, titel, categorie, status, foto-aantal, laatst geïndexeerd). Gebruik sticker_range_start/end voor snelle bereik-selectie.",
  inputSchema: zodToJsonSchema(schema, { target: "openApi3" }),
};

export async function handleListInventory(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`,
    );
  }
  const { status, category, sticker_range_start, sticker_range_end, limit } =
    parsed.data;

  const supabase = getSupabase();
  let query = supabase
    .from("products")
    .select(
      "id, sticker_id, working_title, title, category_slug, status, indexed_at, photos(count)",
    )
    .order("indexed_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (category) query = query.eq("category_slug", category);
  if (sticker_range_start) query = query.gte("sticker_id", sticker_range_start);
  if (sticker_range_end) query = query.lte("sticker_id", sticker_range_end);

  const { data, error } = await query;
  if (error) return errorContent(error.message);

  const rows = (data ?? []).map((p) => {
    const photoCount = Array.isArray(p.photos) ? (p.photos[0]?.count ?? 0) : 0;
    return {
      id: p.id,
      sticker_id: p.sticker_id,
      title: p.title ?? p.working_title ?? null,
      category: p.category_slug,
      status: p.status,
      photo_count: photoCount,
      indexed_at: p.indexed_at,
    };
  });

  if (parsed.data.has_photos) {
    const filtered = rows.filter((r) => r.photo_count > 0);
    return jsonContent(
      { total: filtered.length, products: filtered },
      `Inventaris (${filtered.length} van max ${limit}, alleen met foto's):`,
    );
  }

  return jsonContent(
    { total: rows.length, products: rows },
    `Inventaris (${rows.length} van max ${limit}):`,
  );
}
