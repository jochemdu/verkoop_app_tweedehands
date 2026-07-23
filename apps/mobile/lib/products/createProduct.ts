// Legacy-subpad: readAsStringAsync/EncodingType verhuisden in SDK 54+ naar
// de nieuwe File-API; het legacy-pad houdt de stabiele functie zonder de
// deprecation-warning die de hoofdmodule zou geven.
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { insertProductWithPhotos } from "@verkoopassistent/shared";
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

// Batch-scan (fase 47): maak een fotoloos stub-product op basis van alleen een
// barcode + (optionele) titel. Foto's, sticker en analyse volgen later. Gebruikt
// dezelfde gedeelde insert-kern zodat rollback/consistentie identiek blijft.
export async function createProductStub(input: {
  userId: string;
  ean?: string | null;
  workingTitle?: string | null;
  indexingNotes?: string | null;
}): Promise<{ productId: string }> {
  const result = await insertProductWithPhotos(supabase, {
    product: {
      ean: input.ean || null,
      working_title: input.workingTitle || null,
      indexing_notes: input.indexingNotes || null,
      status: "indexed",
      user_id: input.userId,
    },
    photos: [],
  });
  if (!result.ok) throw new Error(result.error);
  return { productId: result.product.id };
}

// Foto's toevoegen aan een BESTAAND product (camera of galerij vanaf de
// inventory-lijst). Uploadt naar Storage, bepaalt de volgende order_index na de
// bestaande foto's, en maakt de photos-rijen aan. workspace_id wordt door de
// BEFORE INSERT-trigger ingevuld; RLS bewaakt workspace-lidmaatschap. Rolt
// geüploade bestanden terug als de insert faalt.
export async function addPhotosToProduct(input: {
  userId: string;
  productId: string;
  photos: PhotoInput[];
}): Promise<{ added: number }> {
  if (input.photos.length === 0) return { added: 0 };

  const { data: existing } = await supabase
    .from("photos")
    .select("order_index")
    .eq("product_id", input.productId)
    .order("order_index", { ascending: false })
    .limit(1);
  const startIndex = (existing?.[0]?.order_index ?? -1) + 1;

  const uploaded: Array<{ path: string; sizeBytes: number }> = [];
  try {
    for (let i = 0; i < input.photos.length; i++) {
      uploaded.push(await uploadOne(input.userId, input.photos[i]!, startIndex + i));
    }
  } catch (err) {
    if (uploaded.length > 0) {
      await supabase.storage
        .from("product-photos")
        .remove(uploaded.map((u) => u.path));
    }
    throw err;
  }

  const { error } = await supabase.from("photos").insert(
    input.photos.map((p, idx) => ({
      product_id: input.productId,
      storage_path: uploaded[idx]!.path,
      order_index: startIndex + idx,
      photo_type: (p.photoType ?? "general") as "general",
      capture_mode: p.captureMode ?? null,
      width: p.width ?? null,
      height: p.height ?? null,
      size_bytes: uploaded[idx]!.sizeBytes,
      user_id: input.userId,
    })),
  );
  if (error) {
    await supabase.storage
      .from("product-photos")
      .remove(uploaded.map((u) => u.path));
    throw new Error(error.message);
  }
  return { added: input.photos.length };
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

  // 2+3. Product- + foto-rijen via de gedeelde kern (upload/insert/rollback op
  //       één plek, consistent met de web-app). user_id expliciet: mobiel draait
  //       onder de user-JWT maar expliciet is robuuster.
  const result = await insertProductWithPhotos(supabase, {
    product: {
      sticker_id: input.stickerId || null,
      sticker_input_method: input.stickerId ? input.stickerInputMethod : null,
      sticker_confidence: input.stickerConfidence ?? null,
      working_title: input.workingTitle || null,
      indexing_notes: input.indexingNotes || null,
      ean: input.ean || null,
      status: "indexed",
      user_id: input.userId,
    },
    photos: input.photos.map((p, idx) => ({
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
    cleanupPaths: uploaded.map((u) => u.path),
  });
  if (!result.ok) throw new Error(result.error);

  return { productId: result.product.id };
}
