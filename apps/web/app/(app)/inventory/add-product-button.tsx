"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  productIndexSchema,
  type ProductIndexInput,
  CATEGORY_SLUGS,
} from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/client";
import { resizeImage, filenameFor } from "@/lib/image";

export function AddProductButton() {
  const t = useTranslations("inventory");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn btn-accent"
      >
        {t("addProduct")}
      </button>
      {open && <AddProductModal onClose={() => setOpen(false)} />}
    </>
  );
}

function AddProductModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const t = useTranslations("inventory");
  const tc = useTranslations("categoryNames");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductIndexInput>({
    resolver: zodResolver(productIndexSchema),
    defaultValues: { category_slug: "unknown" },
  });

  async function onSubmit(data: ProductIndexInput) {
    setUploading(true);
    const supabase = createClient();
    const photo_paths: string[] = [];
    try {
      // Upload elke foto eerst naar storage.
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const resized = await resizeImage(file);
        const name = filenameFor(i, file.name);
        const path = `inbox/${name}`;
        const { error } = await supabase.storage
          .from("product-photos")
          .upload(path, resized, { contentType: "image/jpeg" });
        if (error) throw new Error(t("uploadFailed", { msg: error.message }));
        photo_paths.push(path);
      }

      // Maak product + photos aan.
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, photo_paths }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Cleanup uploads bij serverfout.
        if (photo_paths.length > 0) {
          await supabase.storage.from("product-photos").remove(photo_paths);
        }
        throw new Error(json.error ?? t("createFailed"));
      }
      toast.success(t("created"));
      onClose();
      router.refresh();
      router.push(
        `/inventory/${json.product.sticker_id ?? json.product.id}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("unknownError"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20"
      onClick={(e) => e.target === e.currentTarget && !uploading && onClose()}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="card w-full max-w-lg space-y-4 p-6 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("modalTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="text-xl leading-none text-muted-foreground"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs">
            <span className="font-medium">{t("stickerIdLabel")}</span>
            <input
              {...register("sticker_id")}
              placeholder="0042"
              className="input font-mono"
            />
            {errors.sticker_id && (
              <span className="text-destructive">{errors.sticker_id.message}</span>
            )}
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium">{t("category")}</span>
            <select
              {...register("category_slug")}
              className="input"
            >
              {CATEGORY_SLUGS.map((c) => (
                <option key={c} value={c}>
                  {tc.has(c) ? tc(c) : c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1 text-xs">
          <span className="font-medium">{t("workingTitleLabel")}</span>
          <input
            {...register("working_title")}
            placeholder="bijv. DDR2 SODIMM Samsung"
            className="input"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-medium">{t("notesLabel")}</span>
          <textarea
            {...register("indexing_notes")}
            rows={2}
            className="input"
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-medium">{t("photosLabel")}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="w-full text-sm"
          />
          {files.length > 0 && (
            <span className="text-muted-foreground">
              {t("filesSelected", { count: files.length })}
            </span>
          )}
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="btn btn-outline"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={uploading}
            className="btn btn-accent"
          >
            {uploading ? t("busy") : t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
