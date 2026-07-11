import { z } from "zod";
import { sanitizeForLLM } from "@verkoopassistent/shared";
import { getSupabase } from "../lib/supabase.js";
import { jsonContent, errorContent } from "../lib/format.js";

const schema = z.object({
  notable_limit: z
    .number()
    .int()
    .min(0)
    .max(50)
    .default(20)
    .describe("Aantal 'notable' (recent of meest gefotografeerd) items in samenvatting."),
});

export const inventorySummaryDefinition = {
  name: "get_inventory_summary",
  description:
    "Geef een compacte samenvatting van de inventaris: totalen per categorie/status + notable items met korte beschrijving. Gebruik voor Feat 20 (Claude Room Audit): na deze summary kan de gebruiker een foto van zijn kamer delen en vraag jij welke items er nog ontbreken in de inventaris.",
  inputSchema: z.toJSONSchema(schema),
};

export async function handleInventorySummary(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return errorContent(`Ongeldige invoer: ${parsed.error.issues.map((i) => i.message).join("; ")}`);

  const supabase = getSupabase();

  // Totals per categorie en status.
  const { data: allRows, error } = await supabase
    .from("products")
    .select("id, sticker_id, working_title, title, category_slug, status, indexed_at")
    .is("deleted_at", null);
  if (error) return errorContent(error.message);

  const byCat = new Map<string, number>();
  const byStatus = new Map<string, number>();
  (allRows ?? []).forEach((p) => {
    byCat.set(p.category_slug ?? "unknown", (byCat.get(p.category_slug ?? "unknown") ?? 0) + 1);
    byStatus.set(p.status ?? "indexed", (byStatus.get(p.status ?? "indexed") ?? 0) + 1);
  });

  // Notable: laatst geïndexeerd, N items.
  const notable = (allRows ?? [])
    .sort((a, b) => (b.indexed_at ?? "").localeCompare(a.indexed_at ?? ""))
    .slice(0, parsed.data.notable_limit)
    .map((p) => ({
      sticker_id: p.sticker_id,
      title: sanitizeForLLM(p.title ?? p.working_title ?? ""),
      category: p.category_slug,
      status: p.status,
    }));

  return jsonContent(
    {
      total: allRows?.length ?? 0,
      by_category: Object.fromEntries(byCat),
      by_status: Object.fromEntries(byStatus),
      notable_recent: notable,
      hint:
        "Gebruiker kan nu een foto van een kamer sturen. Vergelijk wat je ziet met by_category + notable_recent. Voor items die NIET in de samenvatting staan: gebruik create_product_stub om een placeholder te maken zodat de gebruiker later fysiek een sticker kan plakken.",
    },
    `Inventaris-samenvatting (${allRows?.length ?? 0} items):`,
  );
}
