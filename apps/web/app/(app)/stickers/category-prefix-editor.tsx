"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type Category = { slug: string; name: string };

// Beheer van sticker-prefixes per categorie (los van printen). Wat je hier
// opslaat, stelt de generator daarna automatisch voor en geeft elke categorie
// een eigen unieke code-reeks.
export function CategoryPrefixEditor({
  categories,
  initialPrefixes,
}: {
  categories: Category[];
  initialPrefixes: Record<string, string>;
}) {
  const t = useTranslations("stickers");
  const tc = useTranslations("categoryNames");
  const router = useRouter();
  const [prefixes, setPrefixes] = useState<Record<string, string>>(initialPrefixes);
  const [saving, setSaving] = useState(false);

  function setPrefix(slug: string, raw: string) {
    const clean = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
    setPrefixes((prev) => ({ ...prev, [slug]: clean }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/categories/prefixes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes }),
      });
      const json = (await res.json()) as { saved?: number; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? t("unknownError"));
        return;
      }
      toast.success(t("prefixesSaved", { count: json.saved ?? 0 }));
      router.refresh();
    } catch {
      toast.error(t("unknownError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="section-title">{t("categoryPrefixesTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("categoryPrefixesHelp")}</p>
      </div>

      <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
        {categories.map((c) => (
          <label
            key={c.slug}
            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted"
          >
            <span className="text-sm">{tc.has(c.slug) ? tc(c.slug) : c.name}</span>
            <input
              type="text"
              value={prefixes[c.slug] ?? ""}
              onChange={(e) => setPrefix(c.slug, e.target.value)}
              placeholder={t("prefixPlaceholder")}
              maxLength={6}
              className="input w-28 font-mono uppercase"
              aria-label={`${t("prefix")} — ${tc.has(c.slug) ? tc(c.slug) : c.name}`}
            />
          </label>
        ))}
      </div>

      <button type="button" onClick={save} disabled={saving} className="btn btn-accent">
        {saving ? t("generating") : t("savePrefixes")}
      </button>
    </section>
  );
}
