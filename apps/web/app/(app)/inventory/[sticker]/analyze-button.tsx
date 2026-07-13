"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

export function AnalyzeButton({ productId }: { productId: string }) {
  const router = useRouter();
  const t = useTranslations("product");
  const [busy, setBusy] = useState(false);

  async function analyze() {
    setBusy(true);
    const started = toast.loading(t("analyzeLoading"));
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
        toast.error(json.error ?? t("analyzeFailed"));
        return;
      }
      toast.success(
        t("recognized", {
          title: json.analysis.title,
          price: json.analysis.recommended_price,
        }) + (json.listing_id ? t("draftCreated") : ""),
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
      className="btn btn-accent"
    >
      {busy ? t("analyzing") : (<><Sparkles className="size-4" aria-hidden />{t("analyzeBtn")}</>)}
    </button>
  );
}
