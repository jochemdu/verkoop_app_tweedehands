import { getTranslations, getLocale } from "next-intl/server";
import { localeTag } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { StickerForm } from "./sticker-form";
import { CategoryPrefixEditor } from "./category-prefix-editor";

type StickerSheetRow = {
  id: string;
  start_number: number;
  end_number: number;
  prefix: string | null;
  pdf_storage_path: string | null;
  created_at: string | null;
  printed_at: string | null;
};

// Sticker-label = optionele prefix + 4-cijferig nummer.
function stickerLabel(prefix: string | null, n: number) {
  return `${prefix ?? ""}${String(n).padStart(4, "0")}`;
}

export default async function StickersPage() {
  const supabase = await createClient();
  const wsId = await getActiveWorkspaceId(supabase);

  const [{ data: sheetsRaw }, { data: countersRaw }, { data: prefixMapRaw }, { data: categoriesRaw }] =
    await Promise.all([
      supabase
        .from("sticker_sheets")
        .select("id, start_number, end_number, prefix, pdf_storage_path, created_at, printed_at")
        .order("created_at", { ascending: false })
        .limit(20),
      // Alle tellers (kale reeks + per-prefix) in één keer.
      supabase
        .from("app_settings")
        .select("key, value")
        .like("key", "last_sticker_number%")
        .eq("workspace_id", wsId ?? ""),
      supabase
        .from("app_settings")
        .select("value")
        .eq("key", "category_prefixes")
        .eq("workspace_id", wsId ?? "")
        .maybeSingle(),
      supabase.from("categories").select("slug, name").order("name"),
    ]);
  const sheets: StickerSheetRow[] = sheetsRaw ?? [];

  // Map prefix → laatst-gebruikt nummer ("" = kale reeks).
  const startByPrefix: Record<string, number> = {};
  for (const row of countersRaw ?? []) {
    const key = row.key as string;
    const pre = key === "last_sticker_number" ? "" : key.slice("last_sticker_number:".length);
    startByPrefix[pre] = Number(row.value ?? 0);
  }
  const lastUsed = startByPrefix[""] ?? 0;
  const suggestedStart = Math.max(lastUsed + 1, 1);
  const categoryPrefixes = (prefixMapRaw?.value as Record<string, string> | null) ?? {};
  const categories = (categoriesRaw ?? []).map((c) => ({ slug: c.slug, name: c.name }));

  const t = await getTranslations("stickers");
  const dateTag = localeTag(await getLocale());

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section className="card p-6">
        <p className="text-sm text-muted-foreground">{t("lastUsed")}</p>
        <p className="text-lg font-medium">
          {lastUsed > 0 ? String(lastUsed).padStart(4, "0") : t("none")}
        </p>
      </section>

      <CategoryPrefixEditor
        categories={categories}
        initialPrefixes={categoryPrefixes}
      />

      <StickerForm
        suggestedStart={suggestedStart}
        categories={categories}
        categoryPrefixes={categoryPrefixes}
        startByPrefix={startByPrefix}
      />

      <section>
        <h2 className="section-title mb-3">{t("earlier")}</h2>
        {sheets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {t("emptyEarlier")}
          </div>
        ) : (
          <ul className="card divide-y divide-border">
            {sheets.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between p-3 text-sm"
              >
                <span className="font-mono">
                  {stickerLabel(s.prefix, s.start_number)}–
                  {stickerLabel(s.prefix, s.end_number)}
                </span>
                <span className="text-muted-foreground">
                  {s.created_at
                    ? new Date(s.created_at).toLocaleString(dateTag, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
