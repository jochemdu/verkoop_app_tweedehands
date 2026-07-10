import { z } from "zod";
import { getSupabase } from "../lib/supabase.js";
import { jsonContent, errorContent } from "../lib/format.js";

const schema = z.object({
  listing_id: z.string().uuid().describe("UUID van de listing."),
  listing_url: z
    .string()
    .url()
    .describe(
      "URL van de gepubliceerde advertentie (bijv. https://marktplaats.nl/a/...).",
    ),
  external_id: z
    .string()
    .optional()
    .describe("Platform-specifieke ID (optioneel)."),
});

export const markListingPublishedDefinition = {
  name: "mark_listing_published",
  description:
    "Markeer een listing als gepubliceerd nadat de gebruiker hem handmatig op het platform heeft geplaatst. Zet status=published, slaat listing_url + external_id + published_at op.",
  inputSchema: z.toJSONSchema(schema),
};

export async function handleMarkListingPublished(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  const { listing_id, listing_url, external_id } = parsed.data;

  const supabase = getSupabase();
  const { data: listing, error } = await supabase
    .from("listings")
    .update({
      status: "published",
      listing_url,
      external_id: external_id ?? null,
      published_at: new Date().toISOString(),
    })
    .eq("id", listing_id)
    .select()
    .single();
  if (error || !listing)
    return errorContent(error?.message ?? "listing niet gevonden");

  // Update product status ook naar 'listed' als er een gepubliceerde listing is.
  await supabase
    .from("products")
    .update({ status: "listed" })
    .eq("id", listing.product_id);

  return jsonContent(
    {
      listing_id: listing.id,
      product_id: listing.product_id,
      status: listing.status,
      listing_url: listing.listing_url,
      published_at: listing.published_at,
    },
    `Listing gemarkeerd als gepubliceerd:`,
  );
}
