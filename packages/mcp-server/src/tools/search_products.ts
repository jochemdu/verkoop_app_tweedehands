import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { CATEGORY_SLUGS } from "@verkoopassistent/shared";
import { getSupabase } from "../lib/supabase";
import { jsonContent, errorContent } from "../lib/format";

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
  inputSchema: zodToJsonSchema(schema, { target: "openApi3" }),
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
    .or(
      `title.ilike.%${escaped}%,working_title.ilike.%${escaped}%,description.ilike.%${escaped}%,indexing_notes.ilike.%${escaped}%`,
    )
    .order("indexed_at", { ascending: false })
    .limit(limit);
  if (category) q = q.eq("category_slug", category);

  const { data, error } = await q;
  if (error) return errorContent(error.message);

  return jsonContent(
    { query: escaped, hits: data?.length ?? 0, products: data ?? [] },
    `${data?.length ?? 0} treffer(s) voor "${escaped}":`,
  );
}
