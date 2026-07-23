"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { uploadProductPhotos } from "@/lib/photo-upload";
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
    try {
      const added = await uploadProductPhotos(
        productId,
        userId,
        files.map((f) => ({ blob: f, name: f.name })),
      );
      toast.success(t("added", { count: added }));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("addFailed"));
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
