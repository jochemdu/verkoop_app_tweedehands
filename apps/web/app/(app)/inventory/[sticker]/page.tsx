import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { productIdentifierColumn, localeTag } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";
import { EditProductForm } from "./edit-form";
import { DeleteButton } from "./delete-button";
import { AnalyzeButton } from "./analyze-button";
import { AddPhotosButton } from "./add-photos-button";
import { PhotoTools, type ToolPhoto } from "./photo-tools";
import { PriceChart } from "./price-chart";
import { SoldPriceForm } from "./sold-price-form";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ sticker: string }>;
}) {
  const { sticker } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Accepteer zowel UUID als 4-cijferig sticker_id in de URL.
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq(productIdentifierColumn(sticker), sticker)
    .is("deleted_at", null)
    .maybeSingle();

  if (!product) notFound();

  const { data: photos } = await supabase
    .from("photos")
    .select("id, storage_path, order_index, photo_type")
    .eq("product_id", product.id)
    .order("order_index");

  // Genereer signed URLs (1u geldig) voor alle photos in één batch-call.
  let signedPhotos: ToolPhoto[] = [];
  if (photos && photos.length > 0) {
    const paths = photos.map((p) => p.storage_path);
    const { data: signed } = await supabase.storage
      .from("product-photos")
      .createSignedUrls(paths, 3600);
    if (signed) {
      signedPhotos = photos
        .map((p, i) => ({
          id: p.id,
          url: signed[i]?.signedUrl ?? "",
          storage_path: p.storage_path,
          order_index: p.order_index ?? i,
          photo_type: p.photo_type,
        }))
        .filter((p) => p.url);
    }
  }

  const { data: priceHistory } = await supabase
    .from("price_history")
    .select("price_low, price_avg, price_high, fetched_at")
    .eq("product_id", product.id)
    .order("fetched_at", { ascending: true })
    .limit(60);

  const dateTag = localeTag(await getLocale());
  const priceData = (priceHistory ?? []).map((h) => ({
    label: h.fetched_at
      ? new Date(h.fetched_at).toLocaleDateString(dateTag, { dateStyle: "short" })
      : "",
    low: h.price_low,
    avg: h.price_avg,
    high: h.price_high,
  }));

  const t = await getTranslations("product");
  const tc = await getTranslations("categoryNames");
  const categoryLabel =
    product.category_slug && tc.has(product.category_slug)
      ? tc(product.category_slug)
      : product.category_slug;

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/inventory"
            className="text-sm text-muted-foreground hover:underline"
          >
            {t("back")}
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {product.title ?? product.working_title ?? t("unnamed")}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            {product.sticker_id ?? t("noSticker")} · {categoryLabel} ·{" "}
            {product.status}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddPhotosButton productId={product.id} userId={user!.id} />
          <AnalyzeButton productId={product.id} />
          <DeleteButton productId={product.id} />
        </div>
      </div>

      {signedPhotos.length > 0 ? (
        <PhotoTools
          productId={product.id}
          userId={user!.id}
          photos={signedPhotos}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("noPhotos")}
        </div>
      )}

      {Array.isArray(product.photo_advice) && product.photo_advice.length > 0 && (
        <section className="rounded-xl border border-warning bg-warning-soft p-4">
          <h2 className="section-title text-warning">{t("photoTipsTitle")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {product.photo_advice.map((tip: string, i: number) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </section>
      )}

      <PriceChart data={priceData} />

      <SoldPriceForm
        productId={product.id}
        recommendedPrice={product.recommended_price}
        soldPrice={product.sold_price}
        soldAt={product.sold_at}
      />

      <EditProductForm product={product} />
    </main>
  );
}
