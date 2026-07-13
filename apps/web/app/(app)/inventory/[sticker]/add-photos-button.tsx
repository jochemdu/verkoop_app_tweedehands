"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { resizeImage, filenameFor } from "@/lib/image";
import { Camera } from "lucide-react";

export function AddPhotosButton({
  productId,
  userId,
}: {
  productId: string;
  userId: string;
}) {
  const router = useRouter();
  const t = useTranslations("product");
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setBusy(true);
    const supabase = createClient();
    const uploadedPaths: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const resized = await resizeImage(files[i]!);
        const path = `${userId}/inbox/${filenameFor(i, files[i]!.name)}`;
        const { error } = await supabase.storage
          .from("product-photos")
          .upload(path, resized, { contentType: "image/jpeg" });
        if (error) throw new Error(t("uploadFailed", { msg: error.message }));
        uploadedPaths.push(path);
      }
      const res = await fetch(`/api/products/${productId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_paths: uploadedPaths }),
      });
      const json = (await res.json()) as { added?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? t("linkFailed"));
      toast.success(t("added", { count: json.added ?? 0 }));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("addFailed"));
      // Files zonder photo-rij niet laten slingeren in storage.
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("product-photos").remove(uploadedPaths);
      }
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={busy}
        className="btn btn-outline"
      >
        {busy ? t("uploading") : (<><Camera className="size-4" aria-hidden />{t("addPhotos")}</>)}
      </button>
    </>
  );
}
