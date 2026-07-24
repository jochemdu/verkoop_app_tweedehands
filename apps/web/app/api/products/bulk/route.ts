import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  stickerIdSchema,
  isSafeInboxPath,
  insertProductWithPhotos,
  stickerRange,
} from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  photo_paths: z
    .array(z.string().min(1).refine(isSafeInboxPath, "Ongeldig storage pad"))
    .min(1)
    .max(100),
  startSticker: stickerIdSchema.optional(),
  mode: z.enum(["per_photo", "single"]).default("per_photo"),
  workingTitle: z.string().max(200).trim().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ongeldige invoer", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { photo_paths, mode, workingTitle } = parsed.data;
  if (!photo_paths.every((p) => isSafeInboxPath(p, user.id))) {
    return NextResponse.json(
      { error: "Storage pad hoort niet bij deze gebruiker" },
      { status: 403 },
    );
  }

  // Mode: single — alle foto's naar één product.
  if (mode === "single") {
    const result = await insertProductWithPhotos(supabase, {
      product: {
        sticker_id: parsed.data.startSticker ?? null,
        sticker_input_method: parsed.data.startSticker ? "manual" : null,
        working_title: workingTitle ?? null,
        user_id: user.id,
      },
      photos: photo_paths.map((path, idx) => ({
        storage_path: path,
        order_index: idx,
        photo_type: "general" as const,
        user_id: user.id,
      })),
      cleanupPaths: photo_paths,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: `Product aanmaken mislukt: ${result.error}` },
        { status: 500 },
      );
    }
    return NextResponse.json({ created: 1, products: [result.product] });
  }

  // Mode: per_photo — reserveer atomisch N sticker-ID's via DB function.
  let stickers: string[] | null = null;
  if (parsed.data.startSticker) {
    // Legacy: user geeft expliciet startSticker → gebruik oude path voor backward compat.
    // We vertrouwen op UNIQUE constraint op sticker_id om conflicten te vangen.
    stickers = stickerRange(
      parseInt(parsed.data.startSticker, 10),
      photo_paths.length,
    );
  } else {
    const { data: reserved, error: reserveErr } = await supabase.rpc(
      "reserve_next_sticker",
      { p_count: photo_paths.length },
    );
    if (reserveErr || !reserved) {
      return NextResponse.json(
        { error: `Sticker-reservering mislukt: ${reserveErr?.message}` },
        { status: 500 },
      );
    }
    stickers = reserved as string[];
  }

  // Batch i.p.v. N× round-trips: één products-insert + één photos-insert.
  // De workspace_id wordt per rij door de BEFORE INSERT-trigger gevuld.
  const productRows = photo_paths.map((_, i) => ({
    sticker_id: stickers![i] ?? null,
    sticker_input_method: stickers![i] ? ("manual_increment" as const) : null,
    working_title: workingTitle ?? null,
    status: "indexed" as const,
    user_id: user.id,
  }));
  const { data: insertedProducts, error: prodErr } = await supabase
    .from("products")
    .insert(productRows)
    .select("id, sticker_id");
  if (prodErr || !insertedProducts) {
    // Geen product-rijen → geüploade foto's opruimen.
    await supabase.storage.from("product-photos").remove(photo_paths);
    return NextResponse.json(
      { error: `Producten aanmaken mislukt: ${prodErr?.message ?? "onbekend"}` },
      { status: 500 },
    );
  }

  // Koppel elke foto aan zijn product via sticker_id (robuust t.o.v. de
  // volgorde waarin Postgres de rijen teruggeeft).
  const idBySticker = new Map(insertedProducts.map((p) => [p.sticker_id, p.id]));
  const photoRows = photo_paths.map((path, i) => ({
    product_id: idBySticker.get(stickers![i] ?? null)!,
    storage_path: path,
    order_index: 0,
    photo_type: "general" as const,
    user_id: user.id,
  }));
  const { error: photoErr } = await supabase.from("photos").insert(photoRows);
  if (photoErr) {
    // Rollback: verwijder de zojuist gemaakte producten + de geüploade foto's.
    await supabase.from("products").delete().in(
      "id",
      insertedProducts.map((p) => p.id),
    );
    await supabase.storage.from("product-photos").remove(photo_paths);
    return NextResponse.json(
      { error: `Foto's koppelen mislukt: ${photoErr.message}` },
      { status: 500 },
    );
  }

  const created = insertedProducts.map((p) => ({
    product_id: p.id,
    sticker_id: p.sticker_id,
  }));
  return NextResponse.json({ created: created.length, products: created });
}
