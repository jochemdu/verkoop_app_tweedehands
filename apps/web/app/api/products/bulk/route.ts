import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  stickerIdSchema,
  isSafeInboxPath,
  insertProductWithPhotos,
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
    stickers = [];
    let cur = parseInt(parsed.data.startSticker, 10);
    for (let i = 0; i < photo_paths.length; i++) {
      if (cur > 9999) break;
      stickers.push(String(cur).padStart(4, "0"));
      cur++;
    }
  } else {
    const { data: reserved, error: reserveErr } = await supabase.rpc(
      "reserve_next_sticker",
      { p_count: photo_paths.length, p_user_id: user.id },
    );
    if (reserveErr || !reserved) {
      return NextResponse.json(
        { error: `Sticker-reservering mislukt: ${reserveErr?.message}` },
        { status: 500 },
      );
    }
    stickers = reserved as string[];
  }

  const created: Array<{ product_id: string; sticker_id: string | null }> = [];
  const errors: Array<{ photo_path: string; error: string }> = [];

  for (let i = 0; i < photo_paths.length; i++) {
    const path = photo_paths[i]!;
    const sticker = stickers[i] ?? null;
    const result = await insertProductWithPhotos(supabase, {
      product: {
        sticker_id: sticker,
        sticker_input_method: sticker ? "manual_increment" : null,
        working_title: workingTitle ?? null,
        user_id: user.id,
      },
      photos: [
        {
          storage_path: path,
          order_index: 0,
          photo_type: "general" as const,
          user_id: user.id,
        },
      ],
      cleanupPaths: [path],
    });
    if (!result.ok) {
      errors.push({ photo_path: path, error: result.error });
      continue;
    }
    created.push({ product_id: result.product.id, sticker_id: sticker });
  }

  return NextResponse.json({
    created: created.length,
    errors,
    products: created,
  });
}
