import { z } from "zod";
import {
  PRODUCT_STATUSES,
  CATEGORY_SLUGS,
  stickerIdSchema,
  sanitizeForLLM,
} from "@verkoopassistent/shared";
import { getSupabase } from "../lib/supabase.js";
import { jsonContent, errorContent } from "../lib/format.js";
import { getOwnerId } from "../lib/owner.js";

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
  inputSchema: z.toJSONSchema(schema),
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

  // Fase 14: N+1 fix via RPC. OWNER_USER_ID env of fallback: lees uit
  // eerste app_settings rij (single-user opstelling).
  const supabase = getSupabase();
  let ownerId: string;
  try {
    ownerId = await getOwnerId();
  } catch (err) {
    return errorContent(err instanceof Error ? err.message : "owner onbekend");
  }

  const { data, error } = await supabase.rpc("list_inventory_with_counts", {
    p_user_id: ownerId,
    p_status: status ?? undefined,
    p_category: category ?? undefined,
    p_sticker_from: sticker_range_start ?? undefined,
    p_sticker_to: sticker_range_end ?? undefined,
    p_limit: limit,
  });
  if (error) return errorContent(error.message);

  const rows = (data ?? []).map((p) => ({
    id: p.id,
    sticker_id: p.sticker_id,
    title: sanitizeForLLM(p.title ?? p.working_title ?? null) || null,
    category: p.category_slug,
    status: p.status,
    photo_count: Number(p.photo_count ?? 0),
    indexed_at: p.indexed_at,
  }));

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
