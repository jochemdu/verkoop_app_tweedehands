import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Gedeelde product-aanmaak-kern (fase 41). De web-routes (/api/products,
// /api/products/bulk) en de mobiele createProductWithPhotos hadden elk hun eigen
// insert-product → insert-photos → rollback-implementatie, die uiteenliep (bron
// van meerdere bulk-bugs). Deze functie is de ene bron van waarheid voor die
// kern; het uploaden van bestanden blijft platform-specifiek (browser uploadt
// client-side, mobiel uploadt zelf) en levert alleen de storage-paden aan.

type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type PhotoInsert = Database["public"]["Tables"]["photos"]["Insert"];

const STORAGE_BUCKET = "product-photos";

export type InsertProductWithPhotosOptions = {
  /** Volledige product-insert payload (incl. user_id). */
  product: ProductInsert;
  /** Photo-rijen zonder product_id — die wordt na de product-insert ingevuld. */
  photos: Array<Omit<PhotoInsert, "product_id">>;
  /** Storage-paden die bij een rollback opgeruimd moeten worden. */
  cleanupPaths?: string[];
};

export type InsertProductWithPhotosResult =
  | { ok: true; product: ProductRow }
  | { ok: false; error: string; code?: string; stickerConflict: boolean };

/**
 * Maakt een product + zijn foto-rijen aan in één logische operatie en rolt
 * volledig terug bij een fout: mislukt de product-insert dan worden de
 * geüploade bestanden verwijderd; mislukt de photo-insert dan worden zowel de
 * product-rij als de bestanden verwijderd. Zo blijven er nooit fotoloze
 * producten of wees-objecten in storage achter.
 */
export async function insertProductWithPhotos(
  supabase: SupabaseClient<Database>,
  { product, photos, cleanupPaths = [] }: InsertProductWithPhotosOptions,
): Promise<InsertProductWithPhotosResult> {
  const removeUploads = async () => {
    if (cleanupPaths.length > 0) {
      await supabase.storage.from(STORAGE_BUCKET).remove(cleanupPaths);
    }
  };

  const { data: created, error: productErr } = await supabase
    .from("products")
    .insert(product)
    .select()
    .single();
  if (productErr || !created) {
    await removeUploads();
    return {
      ok: false,
      error: productErr?.message ?? "Product aanmaken mislukt",
      code: productErr?.code,
      // 23505 = unique_violation; op products is dat de sticker-uniekheid
      // (products_workspace_sticker_unique, fase 49 — per workspace). De message
      // bevat de constraint-naam, dus matchen we op "sticker".
      stickerConflict:
        productErr?.code === "23505" &&
        Boolean(productErr?.message?.toLowerCase().includes("sticker")),
    };
  }

  if (photos.length > 0) {
    const rows = photos.map((p) => ({ ...p, product_id: created.id }));
    const { error: photoErr } = await supabase.from("photos").insert(rows);
    if (photoErr) {
      await supabase.from("products").delete().eq("id", created.id);
      await removeUploads();
      return {
        ok: false,
        error: photoErr.message,
        code: photoErr.code,
        stickerConflict: false,
      };
    }
  }

  return { ok: true, product: created };
}
