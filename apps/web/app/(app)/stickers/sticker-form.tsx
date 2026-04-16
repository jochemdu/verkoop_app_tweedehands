"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  stickerSheetGenerateSchema,
  type StickerSheetGenerateInput,
} from "@verkoopassistent/shared";

type GenerateResult = {
  pdfUrl: string;
  expiresInSeconds: number;
  sheet: { id: string; start_number: number; end_number: number };
};

export function StickerForm({ suggestedStart }: { suggestedStart: number }) {
  const [result, setResult] = useState<GenerateResult | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StickerSheetGenerateInput>({
    resolver: zodResolver(stickerSheetGenerateSchema),
    defaultValues: { startNumber: suggestedStart, count: 160 },
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
      className="space-y-4 rounded-lg border p-6"
    >
      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Startnummer</span>
          <input
            type="number"
            min={1}
            max={9999}
            className="w-full rounded-md border px-3 py-2 text-sm font-mono shadow-sm"
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
            className="w-full rounded-md border px-3 py-2 text-sm font-mono shadow-sm"
            {...register("count", { valueAsNumber: true })}
          />
          {errors.count && (
            <span className="text-xs text-destructive">{errors.count.message}</span>
          )}
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Genereren…" : "Genereer & print"}
        </button>
        {result && (
          <a
            href={result.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline"
          >
            PDF openen (geldig 1 uur)
          </a>
        )}
      </div>

      {result && (
        <div className="rounded-md border bg-muted p-4 text-xs">
          <p className="font-medium">
            Tip: open de PDF, print met <em>Werkelijk formaat</em> (geen
            schaling) op stickerpapier A4.
          </p>
        </div>
      )}
    </form>
  );
}
