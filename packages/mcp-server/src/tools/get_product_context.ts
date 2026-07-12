import { z } from "zod";
import { getSupabase } from "../lib/supabase.js";
import { resolveProductId } from "../lib/resolve.js";
import { errorContent, jsonContent } from "../lib/format.js";

const schema = z.object({
  product: z
    .string()
    .describe("UUID van een product OF 4-cijferig sticker-ID (bijv. '0042')."),
  photo_urls: z
    .boolean()
    .default(true)
    .describe("Ook signed foto-URLs meegeven (1 uur geldig)."),
});

export const getProductContextDefinition = {
  name: "get_product_context",
  description:
    "Alles over één product in één call (fase 29): productdata + specs, foto-URLs, bestaande advertenties, eerder marktonderzoek en de categorie. Gebruik dit als startpunt voor marktonderzoek of het schrijven van een verkooptekst — daarna: zoek op het web naar vergelijkbare (verkochte) advertenties en sla je vondsten op met save_market_research.",
  inputSchema: z.toJSONSchema(schema),
};

export async function handleGetProductContext(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }

  let productId: string;
  try {
    productId = await resolveProductId(parsed.data.product);
  } catch (err) {
    return errorContent(err instanceof Error ? err.message : "unknown");
  }

  const supabase = getSupabase();
  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id, sticker_id, working_title, title, description, category_slug, condition, status, specs, defects, included_accessories, missing_items, ean, estimated_value_min, estimated_value_max, recommended_price, sold_price, indexing_notes, photo_advice, analyzed_at",
    )
    .eq("id", productId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return errorContent(error.message);
  if (!product) return errorContent("Product niet gevonden (of verwijderd).");

  const [{ data: category }, { data: listings }, { data: comparables }, photosResult] =
    await Promise.all([
      product.category_slug
        ? supabase
            .from("categories")
            .select("slug, name, preferred_platforms")
            .eq("slug", product.category_slug)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("listings")
        .select(
          "id, status, price, final_title, final_description, listing_url, published_at, platforms(slug, name)",
        )
        .eq("product_id", productId),
      supabase
        .from("market_comparables")
        .select(
          "source, url, title, price, currency, is_sold, condition, brand, model, color, notes, created_at",
        )
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(25),
      parsed.data.photo_urls
        ? supabase
            .from("photos")
            .select("storage_path, photo_type, order_index")
            .eq("product_id", productId)
            .order("order_index")
        : Promise.resolve({ data: null }),
    ]);

  let photos: Array<{ url: string | null; photo_type: string | null }> = [];
  const photoRows = photosResult.data;
  if (photoRows && photoRows.length > 0) {
    const { data: signed } = await supabase.storage
      .from("product-photos")
      .createSignedUrls(
        photoRows.map((p) => p.storage_path),
        3600,
      );
    photos = photoRows.map((p, i) => ({
      url: signed?.[i]?.signedUrl ?? null,
      photo_type: p.photo_type,
    }));
  }

  return jsonContent(
    {
      product,
      category,
      photos,
      listings: listings ?? [],
      market_comparables: comparables ?? [],
      next_steps:
        "Voor marktonderzoek: zoek op web naar dit product op Marktplaats/Vinted/eBay (gebruik merk+model+kleur), verzamel per advertentie prijs/staat/tekst en sla alles in één keer op met save_market_research. Voor een verkooptekst: gebruik create_listing.",
    },
    `Context voor ${product.sticker_id ?? productId}: ${product.title ?? product.working_title ?? "(naamloos)"}`,
  );
}
