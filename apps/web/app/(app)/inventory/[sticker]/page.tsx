import { notFound } from "next/navigation";
import Link from "next/link";
import { productIdentifierColumn } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";
import { EditProductForm } from "./edit-form";
import { DeleteButton } from "./delete-button";
import { AnalyzeButton } from "./analyze-button";
import { AddPhotosButton } from "./add-photos-button";
import { PhotoTools, type ToolPhoto } from "./photo-tools";

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

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/inventory"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Inventaris
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {product.title ?? product.working_title ?? "(naamloos)"}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            {product.sticker_id ?? "geen sticker"} · {product.category_slug} ·{" "}
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
          Geen foto&apos;s.
        </div>
      )}

      {Array.isArray(product.photo_advice) && product.photo_advice.length > 0 && (
        <section className="rounded-xl border border-warning bg-warning-soft p-4">
          <h2 className="section-title text-warning">Fototips van de AI</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {product.photo_advice.map((tip: string, i: number) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </section>
      )}

      <EditProductForm product={product} />
    </main>
  );
}
