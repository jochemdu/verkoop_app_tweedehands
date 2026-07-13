"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type Product = {
  id: string;
  sticker_id: string | null;
  working_title: string | null;
  title: string | null;
  category_slug: string | null;
  status: string | null;
};

export function TaxatieForm({ products }: { products: Product[] }) {
  const t = useTranslations("taxatie");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p.id)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      toast.error(t("needSelection"));
      return;
    }
    setGenerating(true);
    setResultUrl(null);
    try {
      const res = await fetch("/api/taxatie/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_ids: Array.from(selected),
          recipient_name: recipientName || undefined,
          recipient_email: recipientEmail || undefined,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t("pdfFailed"));
      setResultUrl(json.pdfUrl);
      toast.success(t("dossierGenerated", { count: json.products_included }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("unknown"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("emptyPre")}
          <code>antique_tin</code>, <code>antique_silver</code>
          {t("emptyOr")}
          <code>antique_other</code>
          {t("emptyPost")}
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">{t("selection")}</h2>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-accent hover:underline"
            >
              {selected.size === products.length
                ? t("selectNoneBtn")
                : t("selectAllBtn")}
            </button>
          </div>

          <ul className="card max-h-64 space-y-1 overflow-y-auto p-2 text-sm">
            {products.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span className="w-14 font-mono text-xs">
                    {p.sticker_id ?? "—"}
                  </span>
                  <span className="flex-1 truncate">
                    {p.title ?? p.working_title ?? t("noTitle")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.category_slug}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t("recipientLabel")}</span>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder={t("recipientPlaceholder")}
                className="input"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t("emailLabel")}</span>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className="input"
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t("noteLabel")}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t("notePlaceholder")}
              className="input"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={generating || selected.size === 0}
              className="btn btn-accent"
            >
              {generating
                ? t("generating")
                : t("generate", { count: selected.size })}
            </button>
            {resultUrl && (
              <a
                href={resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-accent hover:underline"
              >
                {t("openPdf")}
              </a>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
