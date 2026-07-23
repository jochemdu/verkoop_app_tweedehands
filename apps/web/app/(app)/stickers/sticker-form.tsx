"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  stickerSheetGenerateSchema,
  STICKER_PRESETS,
  type StickerSheetGenerateInput,
  type StickerPreset,
} from "@verkoopassistent/shared";

type GenerateResult = {
  pdfUrl: string;
  expiresInSeconds: number;
  sheet: { id: string; start_number: number; end_number: number };
};

// preset → i18n-sleutel (stickers-namespace). Wordt ook door de inventaris-
// printmodal gebruikt.
export const PRESET_LABEL_KEYS: Record<StickerPreset, string> = {
  compact_21x15: "presetCompact",
  medium_38x21: "presetMedium",
  large_63x38: "presetLarge",
};

type StickerFormProps = {
  suggestedStart: number;
  categories: { slug: string; name: string }[];
  categoryPrefixes: Record<string, string>;
  startByPrefix: Record<string, number>;
};

export function StickerForm({
  suggestedStart,
  categories,
  categoryPrefixes,
  startByPrefix,
}: StickerFormProps) {
  const t = useTranslations("stickers");
  const tc = useTranslations("categoryNames");
  const [result, setResult] = useState<GenerateResult | null>(null);
  // Categorie + prefix worden los van react-hook-form beheerd: het startnummer
  // volgt de eigen teller per prefix.
  const [category, setCategory] = useState("");
  const [prefix, setPrefix] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StickerSheetGenerateInput>({
    resolver: zodResolver(stickerSheetGenerateSchema),
    defaultValues: {
      startNumber: suggestedStart,
      count: 160,
      preset: "compact_21x15",
      withQr: false,
    },
  });

  // Startnummer = laatst-gebruikt + 1 voor de gekozen prefix (of de kale reeks).
  function suggestStart(pre: string) {
    setValue("startNumber", Math.max((startByPrefix[pre] ?? 0) + 1, 1));
  }

  function onCategoryChange(slug: string) {
    setCategory(slug);
    const mapped = categoryPrefixes[slug] ?? "";
    setPrefix(mapped);
    suggestStart(mapped);
  }

  function onPrefixChange(raw: string) {
    const clean = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
    setPrefix(clean);
    suggestStart(clean);
  }

  async function onSubmit(data: StickerSheetGenerateInput) {
    const payload = {
      ...data,
      prefix: prefix || undefined,
      categorySlug: category || undefined,
    };
    const res = await fetch("/api/stickers/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as GenerateResult & { error?: string };
    if (!res.ok) {
      toast.error(json.error ?? t("unknownError"));
      return;
    }
    setResult(json);
    const pad = (n: number) => `${prefix}${String(n).padStart(4, "0")}`;
    toast.success(
      t("sheetGenerated", {
        range: `${pad(json.sheet.start_number)}–${pad(json.sheet.end_number)}`,
      }),
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="card space-y-4 p-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("category")}</span>
          <select
            className="input"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="">{t("categoryNone")}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {tc.has(c.slug) ? tc(c.slug) : c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("prefix")}</span>
          <input
            type="text"
            inputMode="text"
            placeholder={t("prefixPlaceholder")}
            className="input font-mono uppercase"
            value={prefix}
            onChange={(e) => onPrefixChange(e.target.value)}
            maxLength={6}
          />
          <span className="block text-xs text-muted-foreground">
            {prefix
              ? t("prefixPreview", { example: `${prefix}0001` })
              : t("prefixHelp")}
          </span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("startNumber")}</span>
          <input
            type="number"
            min={1}
            max={9999}
            className="input font-mono"
            {...register("startNumber", { valueAsNumber: true })}
          />
          {errors.startNumber && (
            <span className="text-xs text-destructive">
              {errors.startNumber.message}
            </span>
          )}
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("count")}</span>
          <input
            type="number"
            min={1}
            max={160}
            className="input font-mono"
            {...register("count", { valueAsNumber: true })}
          />
          {errors.count && (
            <span className="text-xs text-destructive">{errors.count.message}</span>
          )}
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("format")}</span>
          <select
            className="input"
            {...register("preset")}
          >
            {STICKER_PRESETS.map((p) => (
              <option key={p} value={p}>
                {t(PRESET_LABEL_KEYS[p])}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" className="size-4" {...register("withQr")} />
          <span>
            <span className="font-medium">{t("qrLabel")}</span>
            <span className="block text-xs text-muted-foreground">{t("qrHelp")}</span>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-accent"
        >
          {isSubmitting ? t("generating") : t("generate")}
        </button>
        {result && (
          <a
            href={result.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent hover:underline"
          >
            {t("openPdf")}
          </a>
        )}
      </div>

      {result && (
        <div className="rounded-lg border border-border bg-muted p-4 text-xs">
          <p className="font-medium">{t("tip")}</p>
        </div>
      )}
    </form>
  );
}
