import { getTranslations, getLocale } from "next-intl/server";
import { localeTag } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { StickerForm } from "./sticker-form";

type StickerSheetRow = {
  id: string;
  start_number: number;
  end_number: number;
  pdf_storage_path: string | null;
  created_at: string | null;
  printed_at: string | null;
};

export default async function StickersPage() {
  const supabase = await createClient();
  const wsId = await getActiveWorkspaceId(supabase);

  const [{ data: sheetsRaw }, { data: settingRaw }] = await Promise.all([
    supabase
      .from("sticker_sheets")
      .select("id, start_number, end_number, pdf_storage_path, created_at, printed_at")
      .order("start_number", { ascending: false })
      .limit(20),
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "last_sticker_number")
      .eq("workspace_id", wsId ?? "")
      .maybeSingle(),
  ]);
  const sheets: StickerSheetRow[] = sheetsRaw ?? [];
  const lastUsed = Number(settingRaw?.value ?? 0);
  const suggestedStart = Math.max(lastUsed + 1, 1);

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

      <StickerForm suggestedStart={suggestedStart} />

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
                  {String(s.start_number).padStart(4, "0")}–
                  {String(s.end_number).padStart(4, "0")}
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
