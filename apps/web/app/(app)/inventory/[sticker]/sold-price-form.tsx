"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function SoldPriceForm({
  productId,
  recommendedPrice,
  soldPrice,
}: {
  productId: string;
  recommendedPrice: number | null;
  soldPrice: number | null;
  soldAt: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("product");
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState(soldPrice != null ? String(soldPrice) : "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (value === "") return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sold_price: Number(value),
          sold_at: new Date().toISOString(),
          status: "sold",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? t("soldFailed"));
        return;
      }
      toast.success(t("soldSaved"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("soldFailed"));
    } finally {
      setSaving(false);
    }
  }

  const current = value === "" ? null : Number(value);
  const showMargin = current != null && recommendedPrice != null;
  const marginAbs = showMargin ? current - recommendedPrice : 0;
  const marginPct = showMargin && recommendedPrice !== 0
    ? (marginAbs / recommendedPrice) * 100
    : 0;

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <h2 className="section-title">{t("soldTitle")}</h2>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">{t("soldLabel")}</span>
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("soldPlaceholder")}
          className="input w-40"
        />
      </label>

      {showMargin && (
        <p
          className={`text-sm font-medium ${
            marginAbs >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {t("marginLabel")} €{marginAbs.toFixed(2)} ({marginPct >= 0 ? "+" : ""}
          {marginPct.toFixed(1)}%)
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn btn-accent">
          {t("soldSave")}
        </button>
      </div>
    </form>
  );
}
