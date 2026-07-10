"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function AnalyzeButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function analyze() {
    setBusy(true);
    const started = toast.loading("AI analyseert de foto's… (kan ~1 min duren)");
    try {
      const res = await fetch(`/api/products/${productId}/analyze`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        error?: string;
        analysis?: { title: string; recommended_price: number; confidence: string };
        listing_id?: string | null;
      };
      toast.dismiss(started);
      if (!res.ok || !json.analysis) {
        toast.error(json.error ?? "Analyse mislukt");
        return;
      }
      toast.success(
        `Herkend: ${json.analysis.title} — advies €${json.analysis.recommended_price}` +
          (json.listing_id ? " · concept-advertentie aangemaakt" : ""),
      );
      router.refresh();
    } finally {
      toast.dismiss(started);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={analyze}
      disabled={busy}
      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
    >
      {busy ? "Analyseren…" : "✨ Analyseer met AI"}
    </button>
  );
}
