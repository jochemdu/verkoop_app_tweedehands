import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Gedeelde data-access laag. Web (anon client + RLS), MCP (service client)
// en toekomstige clients gebruiken déze functies i.p.v. eigen inline queries,
// zodat business-regels (sticker/uuid-resolutie, soft-delete cascade) op één
// plek leven. De functies zijn client-agnostisch: geef een SupabaseClient
// mee — of later een andere implementatie achter hetzelfde interface.

export type Db = SupabaseClient<Database>;

// Een product-referentie is een 4-cijferig sticker-ID óf een UUID.
export function productIdentifierColumn(ref: string): "sticker_id" | "id" {
  return /^\d{4}$/.test(ref) ? "sticker_id" : "id";
}

// Resolvet sticker-ID of UUID naar de product-UUID. Gooit met een duidelijke
// NL message als het product niet bestaat.
export async function resolveProductId(db: Db, ref: string): Promise<string> {
  const column = productIdentifierColumn(ref);
  const { data, error } = await db
    .from("products")
    .select("id")
    .eq(column, ref)
    .maybeSingle();
  if (error) throw new Error(`DB fout: ${error.message}`);
  if (!data) {
    throw new Error(
      column === "sticker_id"
        ? `Geen product met sticker-ID ${ref}. Controleer de sticker of gebruik list_inventory.`
        : `Geen product met id ${ref}.`,
    );
  }
  return data.id;
}

export async function resolveProductIds(
  db: Db,
  refs: string[],
): Promise<{ resolved: string[]; missing: string[] }> {
  const resolved: string[] = [];
  const missing: string[] = [];
  for (const ref of refs) {
    try {
      resolved.push(await resolveProductId(db, ref));
    } catch {
      missing.push(ref);
    }
  }
  return { resolved, missing };
}

// Soft-delete cascade: products + photos + listings krijgen deleted_at.
// Omkeerbaar via restoreProducts.
export async function softDeleteProducts(db: Db, productIds: string[]) {
  const now = new Date().toISOString();
  await db.from("products").update({ deleted_at: now }).in("id", productIds);
  await db.from("photos").update({ deleted_at: now }).in("product_id", productIds);
  await db.from("listings").update({ deleted_at: now }).in("product_id", productIds);
  return { soft_deleted: productIds.length, deleted_at: now };
}

export async function restoreProducts(db: Db, productIds: string[]) {
  await db.from("products").update({ deleted_at: null }).in("id", productIds);
  await db.from("photos").update({ deleted_at: null }).in("product_id", productIds);
  await db.from("listings").update({ deleted_at: null }).in("product_id", productIds);
  return { restored: productIds.length };
}

// Hard delete incl. storage-cleanup van de productfoto's.
// CASCADE in de DB ruimt photos/listings/bundle_items rijen op.
export async function hardDeleteProducts(db: Db, productIds: string[]) {
  const { data: photos } = await db
    .from("photos")
    .select("storage_path")
    .in("product_id", productIds);
  const paths = (photos ?? []).map((p) => p.storage_path);

  const { error } = await db.from("products").delete().in("id", productIds);
  if (error) throw new Error(error.message);
  if (paths.length > 0) {
    await db.storage.from("product-photos").remove(paths);
  }
  return { hard_deleted: productIds.length, removed_photos: paths.length };
}

// Signed URLs voor de (niet-verwijderde) foto's van een product, in
// order_index volgorde.
export async function signedPhotoUrls(
  db: Db,
  productId: string,
  { expiresIn = 3600, limit }: { expiresIn?: number; limit?: number } = {},
) {
  let query = db
    .from("photos")
    .select("id, storage_path, photo_type, order_index")
    .eq("product_id", productId)
    .is("deleted_at", null)
    .order("order_index");
  if (limit) query = query.limit(limit);
  const { data: photos, error } = await query;
  if (error) throw new Error(`DB fout: ${error.message}`);
  if (!photos || photos.length === 0) return [];

  const { data: signed, error: signErr } = await db.storage
    .from("product-photos")
    .createSignedUrls(
      photos.map((p) => p.storage_path),
      expiresIn,
    );
  if (signErr || !signed) {
    throw new Error(`Signed URLs mislukt: ${signErr?.message}`);
  }
  return photos.map((p, i) => ({
    id: p.id,
    photo_type: p.photo_type,
    order_index: p.order_index,
    url: signed[i]?.signedUrl ?? null,
  }));
}
