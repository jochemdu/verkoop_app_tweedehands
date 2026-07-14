"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  SHIPPING_CLASSES,
  estimateShipping,
  type ShippingClass,
} from "@verkoopassistent/shared";

const CLASS_KEY: Record<ShippingClass, string> = {
  letterbox: "classLetterbox",
  parcel: "classParcel",
  large: "classLarge",
};

export function ShippingEstimate({
  productId,
  categorySlug,
  shippingClass,
}: {
  productId: string;
  categorySlug: string | null;
  shippingClass: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("shipping");
  const [saving, setSaving] = useState(false);

  const est = estimateShipping({ shippingClass, categorySlug });

  async function change(next: ShippingClass) {
    if (next === est.shippingClass && !est.suggested) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipping_class: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? t("saveFailed"));
        return;
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <div>
        <h2 className="section-title">{t("title")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex items-end justify-between gap-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("label")}</span>
          <select
            value={est.shippingClass}
            disabled={saving}
            onChange={(e) => change(e.target.value as ShippingClass)}
            className="input w-56"
          >
            {SHIPPING_CLASSES.map((c) => (
              <option key={c} value={c}>
                {t(CLASS_KEY[c])}
              </option>
            ))}
          </select>
        </label>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">
            €{est.price.toFixed(2)}
          </p>
          {est.suggested && (
            <p className="text-xs text-muted-foreground">{t("suggested")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
