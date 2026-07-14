import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  productIndexSchema,
  isSafeInboxPath,
  insertProductWithPhotos,
} from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = productIndexSchema.extend({
  photo_paths: z
    .array(z.string().min(1).refine(isSafeInboxPath, "Ongeldig storage pad"))
    .default([]),
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
  if (!photo_paths.every((p) => isSafeInboxPath(p, user.id))) {
    return NextResponse.json(
      { error: "Storage pad hoort niet bij deze gebruiker" },
      { status: 403 },
    );
  }

  const result = await insertProductWithPhotos(supabase, {
    product: {
      sticker_id: productData.sticker_id ?? null,
      sticker_input_method: productData.sticker_input_method ?? null,
      sticker_confidence: productData.sticker_confidence ?? null,
      category_slug: productData.category_slug,
      working_title: productData.working_title ?? null,
      indexing_notes: productData.indexing_notes ?? null,
      ean: productData.ean ?? null,
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
      {
        error: result.stickerConflict
          ? `Sticker-ID ${productData.sticker_id} bestaat al.`
          : "Product aanmaken mislukt.",
      },
      { status: result.stickerConflict ? 409 : 500 },
    );
  }

  return NextResponse.json({ product: result.product });
}
