import { createClient } from "@/lib/supabase/client";
import { resizeImage, filenameFor } from "@/lib/image";

// Gedeelde client-side foto-upload naar Storage + koppeling aan een bestaand
// product. Zowel de galerij-knop als de camera-opname gebruiken dit, zodat
// resize/upload/rollback/koppelen op één plek leven.

export type UploadItem = { blob: Blob; name: string };

// Uploadt de foto's naar de product-photos bucket en koppelt ze via de
// bestaande /photos-route (die order_index bepaalt en de photos-rijen maakt).
// Rollt geüploade bestanden terug als het koppelen faalt. Retourneert het
// aantal daadwerkelijk toegevoegde foto's.
export async function uploadProductPhotos(
  productId: string,
  userId: string,
  items: UploadItem[],
): Promise<number> {
  if (items.length === 0) return 0;
  const supabase = createClient();
  const uploadedPaths: string[] = [];
  try {
    for (let i = 0; i < items.length; i++) {
      const { blob, name } = items[i]!;
      // resizeImage verwacht een File (leest .name/.type/.size). Camera-blobs
      // wrappen we zodat ze door dezelfde resize + naamgeving gaan.
      const file =
        blob instanceof File
          ? blob
          : new File([blob], name, { type: blob.type || "image/jpeg" });
      const resized = await resizeImage(file);
      const path = `${userId}/inbox/${filenameFor(i, name)}`;
      const { error } = await supabase.storage
        .from("product-photos")
        .upload(path, resized, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      uploadedPaths.push(path);
    }
    const res = await fetch(`/api/products/${productId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_paths: uploadedPaths }),
    });
    const json = (await res.json()) as { added?: number; error?: string };
    if (!res.ok) throw new Error(json.error ?? "link_failed");
    return json.added ?? 0;
  } catch (err) {
    // Geüploade bestanden zonder photo-rij niet laten slingeren.
    if (uploadedPaths.length > 0) {
      await supabase.storage.from("product-photos").remove(uploadedPaths);
    }
    throw err;
  }
}
