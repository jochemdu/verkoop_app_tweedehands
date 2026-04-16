import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getSupabase } from "../lib/supabase";
import { resolveProductId } from "../lib/resolve";
import { errorContent, jsonContent } from "../lib/format";

const schema = z.object({
  product: z
    .string()
    .describe(
      "UUID van een product OF 4-cijferig sticker-ID (bijv. '0042').",
    ),
  expires_in_seconds: z
    .number()
    .int()
    .min(60)
    .max(86400)
    .default(3600)
    .describe("Geldigheidsduur van de signed URL (60–86400 seconden)."),
});

export const getProductPhotosDefinition = {
  name: "get_product_photos",
  description:
    "Haal de foto's van één product op als signed URLs (default 1 uur geldig). Claude Desktop kan deze URLs zien als ze in de conversatie verschijnen — deel ze met de gebruiker zodat jullie samen de foto's kunnen analyseren.",
  inputSchema: zodToJsonSchema(schema, { target: "openApi3" }),
};

export async function handleGetProductPhotos(input: unknown) {
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
  const { data: photos, error } = await supabase
    .from("photos")
    .select(
      "id, storage_path, photo_type, capture_mode, order_index, sticker_visible",
    )
    .eq("product_id", productId)
    .order("order_index");
  if (error) return errorContent(error.message);
  if (!photos || photos.length === 0) {
    return jsonContent(
      { product_id: productId, photos: [] },
      "Geen foto's voor dit product.",
    );
  }

  const paths = photos.map((p) => p.storage_path);
  const { data: signed, error: signedErr } = await supabase.storage
    .from("product-photos")
    .createSignedUrls(paths, parsed.data.expires_in_seconds);
  if (signedErr || !signed) return errorContent(signedErr?.message ?? "unknown");

  const result = photos.map((p, i) => ({
    id: p.id,
    url: signed[i]?.signedUrl ?? null,
    photo_type: p.photo_type,
    capture_mode: p.capture_mode,
    order_index: p.order_index,
    sticker_visible: p.sticker_visible,
  }));

  return jsonContent(
    { product_id: productId, expires_in_seconds: parsed.data.expires_in_seconds, photos: result },
    `${result.length} foto('s) voor product ${productId}:`,
  );
}
