import { z } from "zod";
import { CATEGORY_SLUGS, sanitizeForLLM } from "@verkoopassistent/shared";
import { getSupabase } from "../lib/supabase.js";
import { jsonContent, errorContent } from "../lib/format.js";

const schema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "Vrije zoektekst, matcht op title, working_title, description en indexing_notes (case-insensitive).",
    ),
  category: z.enum(CATEGORY_SLUGS).optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

export const searchProductsDefinition = {
  name: "search_products",
  description:
    "Full-text zoek in producten op titel/omschrijving/notities. Gebruik voor 'welke RAM modules heb ik' of 'zoek Pokémon kaarten uit 1999'.",
  inputSchema: z.toJSONSchema(schema),
};

export async function handleSearchProducts(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  const { query, category, limit } = parsed.data;
  const escaped = query.replace(/[,()]/g, " ").trim();

  const supabase = getSupabase();
  let q = supabase
    .from("products")
    .select(
      "id, sticker_id, working_title, title, description, category_slug, status, indexing_notes, indexed_at",
    )
    .is("deleted_at", null)
    .or(
      `title.ilike.%${escaped}%,working_title.ilike.%${escaped}%,description.ilike.%${escaped}%,indexing_notes.ilike.%${escaped}%`,
    )
    .order("indexed_at", { ascending: false })
    .limit(limit);
  if (category) q = q.eq("category_slug", category);

  const { data, error } = await q;
  if (error) return errorContent(error.message);

  // Sanitize alle user-input velden voordat Claude ze leest.
  const sanitized = (data ?? []).map((p) => ({
    ...p,
    title: sanitizeForLLM(p.title),
    working_title: sanitizeForLLM(p.working_title),
    description: sanitizeForLLM(p.description),
    indexing_notes: sanitizeForLLM(p.indexing_notes),
  }));

  return jsonContent(
    { query: escaped, hits: sanitized.length, products: sanitized },
    `${sanitized.length} treffer(s) voor "${escaped}":`,
  );
}
