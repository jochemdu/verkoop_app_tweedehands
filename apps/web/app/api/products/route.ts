import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { productIndexSchema } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Client uploadt eerst foto's naar product-photos storage, dan POST naar
// deze route met de resulterende storage_paths + metadata.
const bodySchema = productIndexSchema.extend({
  photo_paths: z.array(z.string().min(1)).default([]),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ongeldige invoer", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { photo_paths, ...productData } = parsed.data;

  const { data: product, error: productErr } = await supabase
    .from("products")
    .insert({
      sticker_id: productData.sticker_id ?? null,
      sticker_input_method: productData.sticker_input_method ?? null,
      sticker_confidence: productData.sticker_confidence ?? null,
      category_slug: productData.category_slug,
      working_title: productData.working_title ?? null,
      indexing_notes: productData.indexing_notes ?? null,
      ean: productData.ean ?? null,
    })
    .select()
    .single();
  if (productErr || !product) {
    // Cleanup uploaded photos als product-insert faalt.
    if (photo_paths.length > 0) {
      await supabase.storage.from("product-photos").remove(photo_paths);
    }
    const isSticker = productErr?.message?.includes("sticker_id");
    return NextResponse.json(
      {
        error: isSticker
          ? `Sticker-ID ${productData.sticker_id} bestaat al. Kies een ander nummer.`
          : `Product aanmaken mislukt: ${productErr?.message}`,
      },
      { status: isSticker ? 409 : 500 },
    );
  }

  if (photo_paths.length > 0) {
    const photoRows = photo_paths.map((path, idx) => ({
      product_id: product.id,
      storage_path: path,
      order_index: idx,
      photo_type: "general" as const,
    }));
    const { error: photosErr } = await supabase.from("photos").insert(photoRows);
    if (photosErr) {
      return NextResponse.json(
        {
          product,
          warning: `Product aangemaakt maar foto metadata opslaan mislukt: ${photosErr.message}`,
        },
        { status: 207 },
      );
    }
  }

  return NextResponse.json({ product });
}
