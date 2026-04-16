import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { stickerIdSchema } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Bulk upload: client uploadt N foto's naar storage, daarna POST naar deze
// route met de paden + optioneel een startSticker om auto-increment toe te
// passen per foto.
const bodySchema = z.object({
  photo_paths: z.array(z.string().min(1)).min(1).max(100),
  startSticker: stickerIdSchema.optional(),
  // Wanneer mode = 'single', alle foto's komen aan één product.
  // Wanneer mode = 'per_photo' (default), één product per foto.
  mode: z.enum(["per_photo", "single"]).default("per_photo"),
  workingTitle: z.string().max(200).optional(),
});

function nextSticker(current: string): string {
  const n = parseInt(current, 10) + 1;
  if (n > 9999) throw new Error("sticker-bereik 9999 overschreden");
  return String(n).padStart(4, "0");
}

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
  const { photo_paths, startSticker, mode, workingTitle } = parsed.data;

  // ── Mode: single ─────────────────────────────────────────────
  // Alle foto's naar één product.
  if (mode === "single") {
    const { data: product, error: productErr } = await supabase
      .from("products")
      .insert({
        sticker_id: startSticker ?? null,
        sticker_input_method: startSticker ? "manual" : null,
        working_title: workingTitle ?? null,
      })
      .select()
      .single();
    if (productErr || !product) {
      await supabase.storage.from("product-photos").remove(photo_paths);
      return NextResponse.json(
        { error: `Product aanmaken mislukt: ${productErr?.message}` },
        { status: 500 },
      );
    }
    const photoRows = photo_paths.map((path, idx) => ({
      product_id: product.id,
      storage_path: path,
      order_index: idx,
      photo_type: "general" as const,
    }));
    await supabase.from("photos").insert(photoRows);
    return NextResponse.json({ created: 1, products: [product] });
  }

  // ── Mode: per_photo ──────────────────────────────────────────
  // Eén product per foto, optioneel met auto-incrementing sticker.
  let sticker = startSticker ?? null;
  const created: Array<{ product_id: string; sticker_id: string | null }> = [];
  const errors: Array<{ photo_path: string; error: string }> = [];

  for (let i = 0; i < photo_paths.length; i++) {
    const path = photo_paths[i]!;
    const { data: product, error: productErr } = await supabase
      .from("products")
      .insert({
        sticker_id: sticker,
        sticker_input_method: sticker ? "manual_increment" : null,
        working_title: workingTitle ?? null,
      })
      .select()
      .single();
    if (productErr || !product) {
      errors.push({ photo_path: path, error: productErr?.message ?? "unknown" });
      continue;
    }
    const { error: photoErr } = await supabase.from("photos").insert({
      product_id: product.id,
      storage_path: path,
      order_index: 0,
      photo_type: "general",
    });
    if (photoErr) {
      errors.push({ photo_path: path, error: photoErr.message });
    }
    created.push({ product_id: product.id, sticker_id: sticker });
    if (sticker) {
      try {
        sticker = nextSticker(sticker);
      } catch {
        // stop incrementing als bereik vol is
        sticker = null;
      }
    }
  }

  // Bump last_sticker_number als we sticker-ID's hebben toegekend.
  if (startSticker && created.length > 0) {
    const last = created
      .filter((c) => c.sticker_id !== null)
      .map((c) => parseInt(c.sticker_id!, 10))
      .sort((a, b) => b - a)[0];
    if (last !== undefined) {
      await supabase
        .from("app_settings")
        .update({ value: last })
        .eq("key", "last_sticker_number");
    }
  }

  return NextResponse.json({
    created: created.length,
    errors,
    products: created,
  });
}
