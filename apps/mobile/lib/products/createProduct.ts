// Legacy-subpad: readAsStringAsync/EncodingType verhuisden in SDK 54+ naar
// de nieuwe File-API; het legacy-pad houdt de stabiele functie zonder de
// deprecation-warning die de hoofdmodule zou geven.
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "../supabase";

// Gedeelde product-aanmaak-helper (fase 32). Zowel de capture-tab als de
// camera-roll-import gebruiken dit, zodat upload/insert/rollback op één plek
// leven. Upload via base64→ArrayBuffer (betrouwbaarder in RN dan fetch().blob(),
// dat op sommige RN-versies 0-byte uploads geeft).

export type PhotoInput = {
  uri: string;
  captureMode?: string | null;
  photoType?: string | null;
  width?: number | null;
  height?: number | null;
  stickerVisible?: boolean;
  detectedSticker?: string | null;
  ocrConfidence?: number | null;
};

export type CreateProductInput = {
  userId: string;
  photos: PhotoInput[];
  stickerId?: string | null;
  stickerInputMethod?:
    | "ocr_inline"
    | "ocr_separate"
    | "manual"
    | "manual_increment"
    | null;
  stickerConfidence?: number | null;
  workingTitle?: string | null;
  indexingNotes?: string | null;
  ean?: string | null;
};

async function uploadOne(
  userId: string,
  photo: PhotoInput,
  index: number,
): Promise<{ path: string; sizeBytes: number }> {
  const base64 = await FileSystem.readAsStringAsync(photo.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buffer = decode(base64);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const safeSource = (photo.captureMode ?? "photo").replace(/[^a-z0-9]/gi, "");
  const path = `${userId}/inbox/${ts}_${index}_${safeSource}.jpg`;
  const { error } = await supabase.storage
    .from("product-photos")
    .upload(path, buffer, { contentType: "image/jpeg" });
  if (error) throw new Error(`Upload faalde: ${error.message}`);
  return { path, sizeBytes: buffer.byteLength };
}

export async function createProductWithPhotos(
  input: CreateProductInput,
): Promise<{ productId: string }> {
  if (input.photos.length === 0) throw new Error("Geen foto's meegegeven.");

  // 1. Alle foto's uploaden; bij een fout ruimen we het reeds geüploade op.
  const uploaded: Array<{ path: string; sizeBytes: number }> = [];
  try {
    for (let i = 0; i < input.photos.length; i++) {
      uploaded.push(await uploadOne(input.userId, input.photos[i]!, i));
    }
  } catch (err) {
    if (uploaded.length > 0) {
      await supabase.storage
        .from("product-photos")
        .remove(uploaded.map((u) => u.path));
    }
    throw err;
  }

  // 2. Product-rij. user_id expliciet (mobiel draait onder de user-JWT, maar
  //    expliciet is robuuster en consistent met de web-app).
  const { data: product, error: productErr } = await supabase
    .from("products")
    .insert({
      sticker_id: input.stickerId || null,
      sticker_input_method: input.stickerId ? input.stickerInputMethod : null,
      sticker_confidence: input.stickerConfidence ?? null,
      working_title: input.workingTitle || null,
      indexing_notes: input.indexingNotes || null,
      ean: input.ean || null,
      status: "indexed",
      user_id: input.userId,
    })
    .select("id")
    .single();
  if (productErr || !product) {
    await supabase.storage
      .from("product-photos")
      .remove(uploaded.map((u) => u.path));
    throw new Error(productErr?.message ?? "Product aanmaken mislukt");
  }

  // 3. Photo-rijen (incl. afmetingen/grootte). Faalt dit, dan rollen we het
  //    product én de storage-objecten terug — geen weeskinderen (audit-fix).
  const { error: photoErr } = await supabase.from("photos").insert(
    input.photos.map((p, idx) => ({
      product_id: product.id,
      storage_path: uploaded[idx]!.path,
      order_index: idx,
      photo_type: (p.photoType ?? "general") as "general",
      capture_mode: p.captureMode ?? null,
      sticker_visible: p.stickerVisible ?? false,
      detected_sticker: p.detectedSticker ?? null,
      ocr_confidence: p.ocrConfidence ?? null,
      width: p.width ?? null,
      height: p.height ?? null,
      size_bytes: uploaded[idx]!.sizeBytes,
      user_id: input.userId,
    })),
  );
  if (photoErr) {
    await supabase.from("products").delete().eq("id", product.id);
    await supabase.storage
      .from("product-photos")
      .remove(uploaded.map((u) => u.path));
    throw new Error(`Foto's opslaan mislukt: ${photoErr.message}`);
  }

  return { productId: product.id };
}
