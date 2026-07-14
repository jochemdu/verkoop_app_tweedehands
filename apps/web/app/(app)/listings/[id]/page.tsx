import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ListingActions } from "./listing-actions";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "*, products(id, sticker_id, working_title, title, category_slug), platforms(slug, name, base_url)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!listing) notFound();

  const product = Array.isArray(listing.products)
    ? listing.products[0]
    : listing.products;
  const platform = Array.isArray(listing.platforms)
    ? listing.platforms[0]
    : listing.platforms;

  const t = await getTranslations("listings");

  return (
    <main className="space-y-6">
      <div>
        <Link
          href="/listings"
          className="text-sm text-muted-foreground hover:underline"
        >
          {t("back")}
        </Link>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {listing.final_title ?? listing.generated_title ?? t("noTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{product?.sticker_id ?? "—"}</span> ·{" "}
          {platform?.name} · {t("statusLabel")}{" "}
          <span className="font-medium">{listing.status}</span>
        </p>
      </div>

      <ListingActions
        listing={{
          id: listing.id,
          status: listing.status,
          price: Number(listing.price),
          shipping_price: Number(listing.shipping_price ?? 0),
          final_title: listing.final_title ?? listing.generated_title ?? "",
          final_description:
            listing.final_description ?? listing.generated_description ?? "",
          listing_url: listing.listing_url,
          external_id: listing.external_id,
        }}
        platformName={platform?.name ?? ""}
        platformSlug={platform?.slug ?? ""}
        platformBaseUrl={platform?.base_url ?? null}
        productStickerId={product?.sticker_id ?? ""}
      />
    </main>
  );
}
