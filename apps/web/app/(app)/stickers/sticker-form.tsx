"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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

export const PRESET_LABELS: Record<StickerPreset, string> = {
  compact_21x15: "Compact — 21×15 mm, 160 per vel",
  medium_38x21: "Middel — 38×21 mm, 65 per vel (QR leesbaar)",
  large_63x38: "Groot — 63×38 mm, 21 per vel (QR + groot nummer)",
};

export function StickerForm({ suggestedStart }: { suggestedStart: number }) {
  const [result, setResult] = useState<GenerateResult | null>(null);

  const {
    register,
    handleSubmit,
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

  async function onSubmit(data: StickerSheetGenerateInput) {
    const res = await fetch("/api/stickers/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = (await res.json()) as GenerateResult & { error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Onbekende fout");
      return;
    }
    setResult(json);
    toast.success(
      `Vel gegenereerd: ${String(json.sheet.start_number).padStart(4, "0")}–${String(json.sheet.end_number).padStart(4, "0")}`,
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="card space-y-4 p-6"
    >
      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Startnummer</span>
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
          <span className="font-medium">Aantal stickers</span>
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
          <span className="font-medium">Formaat</span>
          <select
            className="input"
            {...register("preset")}
          >
            {STICKER_PRESETS.map((p) => (
              <option key={p} value={p}>
                {PRESET_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" className="size-4" {...register("withQr")} />
          <span>
            <span className="font-medium">QR-code op elke sticker</span>
            <span className="block text-xs text-muted-foreground">
              Scan opent de productpagina. Op compact-formaat is de QR klein
              (9 mm) — kies Middel of Groot voor vlot scannen.
            </span>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-accent"
        >
          {isSubmitting ? "Genereren…" : "Genereer & print"}
        </button>
        {result && (
          <a
            href={result.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent hover:underline"
          >
            PDF openen (geldig 1 uur)
          </a>
        )}
      </div>

      {result && (
        <div className="rounded-lg border border-border bg-muted p-4 text-xs">
          <p className="font-medium">
            Tip: open de PDF, print met <em>Werkelijk formaat</em> (geen
            schaling) op stickerpapier A4, en knip langs de stippellijnen.
          </p>
        </div>
      )}
    </form>
  );
}
