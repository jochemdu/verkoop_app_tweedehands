import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { EditProductForm } from "./edit-form";
import { DeleteButton } from "./delete-button";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ sticker: string }>;
}) {
  const { sticker } = await params;
  const supabase = await createClient();

  // Accepteer zowel UUID als 4-cijferig sticker_id in de URL.
  const column = /^\d{4}$/.test(sticker) ? "sticker_id" : "id";
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq(column, sticker)
    .maybeSingle();

  if (!product) notFound();

  const { data: photos } = await supabase
    .from("photos")
    .select("id, storage_path, order_index, photo_type")
    .eq("product_id", product.id)
    .order("order_index");

  // Genereer signed URLs (1u geldig) voor alle photos in één batch-call.
  let signedPhotos: Array<{
    id: string;
    url: string;
    photo_type: string | null;
  }> = [];
  if (photos && photos.length > 0) {
    const paths = photos.map((p) => p.storage_path);
    const { data: signed } = await supabase.storage
      .from("product-photos")
      .createSignedUrls(paths, 3600);
    if (signed) {
      signedPhotos = photos.map((p, i) => ({
        id: p.id,
        url: signed[i]?.signedUrl ?? "",
        photo_type: p.photo_type,
      }));
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
          <h1 className="mt-1 text-2xl font-semibold">
            {product.title ?? product.working_title ?? "(naamloos)"}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            {product.sticker_id ?? "geen sticker"} · {product.category_slug} ·{" "}
            {product.status}
          </p>
        </div>
        <DeleteButton productId={product.id} />
      </div>

      {signedPhotos.length > 0 ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {signedPhotos.map((photo) =>
            photo.url ? (
              <a
                key={photo.id}
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                className="relative aspect-square overflow-hidden rounded-md border bg-muted"
              >
                <Image
                  src={photo.url}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
                {photo.photo_type && photo.photo_type !== "general" && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                    {photo.photo_type}
                  </span>
                )}
              </a>
            ) : null,
          )}
        </section>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Geen foto&apos;s.
        </div>
      )}

      <EditProductForm product={product} />
    </main>
  );
}
