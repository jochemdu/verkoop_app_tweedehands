"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PRODUCT_CONDITIONS,
  PRODUCT_STATUSES,
  type ProductCondition,
  type ProductStatus,
} from "@verkoopassistent/shared";

type Product = {
  id: string;
  title: string | null;
  description: string | null;
  condition: ProductCondition | null;
  status: ProductStatus | null;
  recommended_price: number | null;
};

export function EditProductForm({ product }: { product: Product }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: product.title ?? "",
    description: product.description ?? "",
    condition: product.condition ?? "",
    status: product.status ?? "indexed",
    recommended_price: product.recommended_price ?? "",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, unknown> = {};
    if (form.title) payload.title = form.title;
    if (form.description) payload.description = form.description;
    if (form.condition) payload.condition = form.condition;
    if (form.status) payload.status = form.status;
    if (form.recommended_price !== "") {
      payload.recommended_price = Number(form.recommended_price);
    }

    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(json.error ?? "Opslaan mislukt");
      return;
    }
    toast.success("Opgeslagen");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-lg border p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Productgegevens
      </h2>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Definitieve titel</span>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full rounded-md border px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Omschrijving</span>
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-md border px-2 py-1.5 text-sm"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Conditie</span>
          <select
            value={form.condition}
            onChange={(e) =>
              setForm({ ...form, condition: e.target.value as ProductCondition })
            }
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {PRODUCT_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Status</span>
          <select
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as ProductStatus })
            }
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          >
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Adviesprijs €</span>
          <input
            type="number"
            step="0.01"
            value={form.recommended_price}
            onChange={(e) =>
              setForm({ ...form, recommended_price: e.target.value })
            }
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
