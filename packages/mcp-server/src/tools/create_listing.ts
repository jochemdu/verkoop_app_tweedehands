import { z } from "zod";
import { PLATFORM_SLUGS } from "@verkoopassistent/shared";
import { getSupabase } from "../lib/supabase";
import { resolveProductId } from "../lib/resolve";
import { jsonContent, errorContent } from "../lib/format";
import { getOwnerId, getOwnerWorkspaceId } from "../lib/owner.js";

const schema = z.object({
  product: z.string().min(1).describe("UUID of 4-cijferig sticker-ID."),
  platform: z
    .enum(PLATFORM_SLUGS)
    .describe("Platform waarop de advertentie komt."),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  price: z.number().nonnegative(),
  shipping_price: z.number().nonnegative().default(0),
  confirm: z
    .boolean()
    .default(false)
    .describe(
      "Security: mutaties vereisen expliciete confirm=true. Zonder confirm krijg je een dry-run response.",
    ),
});

export const createListingDefinition = {
  name: "create_listing",
  description:
    "Maak een concept-advertentie aan voor een product op een platform. Status is 'pending_review' — de gebruiker moet hem nog goedkeuren in de web-app voordat hij gepubliceerd wordt.",
  inputSchema: z.toJSONSchema(schema),
};

export async function handleCreateListing(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`,
    );
  }
  const { product, platform, title, description, price, shipping_price } = parsed.data;

  if (!parsed.data.confirm) {
    return jsonContent(
      {
        dry_run: true,
        would_create_listing: { product, platform, title, price, shipping_price, status: "pending_review" },
        action_required: "Herhaal met confirm=true na gebruikersbevestiging.",
      },
      `DRY-RUN: listing nog niet aangemaakt.`,
    );
  }

  let productId: string;
  try {
    productId = await resolveProductId(product);
  } catch (err) {
    return errorContent(err instanceof Error ? err.message : "unknown");
  }

  const supabase = getSupabase();
  const { data: platformRow, error: platformErr } = await supabase
    .from("platforms")
    .select("id, name")
    .eq("slug", platform)
    .single();
  if (platformErr || !platformRow) {
    return errorContent(`Platform '${platform}' niet gevonden.`);
  }

  const ownerId = await getOwnerId();
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .insert({
      product_id: productId,
      platform_id: platformRow.id,
      status: "pending_review",
      price,
      shipping_price,
      generated_title: title,
      generated_description: description,
      final_title: title,
      final_description: description,
      user_id: ownerId,
      workspace_id: await getOwnerWorkspaceId(),
    })
    .select()
    .single();
  if (listingErr || !listing) {
    const isDup = listingErr?.message.includes("duplicate");
    return errorContent(
      isDup
        ? `Er bestaat al een advertentie voor dit product op ${platform}. Gebruik de web-app om die te bewerken.`
        : (listingErr?.message ?? "listing insert faalde"),
    );
  }

  return jsonContent(
    {
      listing_id: listing.id,
      product_id: productId,
      platform: platform,
      platform_name: platformRow.name,
      price,
      shipping_price,
      status: listing.status,
    },
    `Draft advertentie aangemaakt voor ${platform} (wacht op review):`,
  );
}
