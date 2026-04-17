"use client";

import { useState } from "react";
import { toast } from "sonner";

type Product = {
  id: string;
  sticker_id: string | null;
  working_title: string | null;
  title: string | null;
  category_slug: string | null;
  status: string | null;
};

export function TaxatieForm({ products }: { products: Product[] }) {
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
      toast.error("Selecteer minstens één product.");
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
      if (!res.ok) throw new Error(json.error ?? "PDF generatie faalde");
      setResultUrl(json.pdfUrl);
      toast.success(
        `Dossier gegenereerd met ${json.products_included} item(s).`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "onbekend");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {products.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Geen antieke items gevonden. Categoriseer producten als{" "}
          <code>antique_tin</code>, <code>antique_silver</code> of{" "}
          <code>antique_other</code> om ze hier te zien.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-lg border p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Selectie
            </h2>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs underline"
            >
              {selected.size === products.length ? "Niks" : "Alles"} selecteren
            </button>
          </div>

          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
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
                    {p.title ?? p.working_title ?? "(geen titel)"}
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
              <span className="font-medium">T.a.v. (optioneel)</span>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Naam taxateur"
                className="w-full rounded-md border px-2 py-1.5 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">E-mail (optioneel)</span>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="taxateur@voorbeeld.nl"
                className="w-full rounded-md border px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">Begeleidende notitie (optioneel)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Context voor de taxateur: wanneer verworven, bron, wensen…"
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={generating || selected.size === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {generating
                ? "Genereren…"
                : `Genereer dossier (${selected.size} item${selected.size === 1 ? "" : "s"})`}
            </button>
            {resultUrl && (
              <a
                href={resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline"
              >
                Open PDF (geldig 1 uur)
              </a>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
