import { createClient } from "@/lib/supabase/server";
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
      .maybeSingle(),
  ]);
  const sheets: StickerSheetRow[] = sheetsRaw ?? [];
  const lastUsed = Number(settingRaw?.value ?? 0);
  const suggestedStart = Math.max(lastUsed + 1, 1);

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Stickervel genereren</h1>
        <p className="text-sm text-muted-foreground">
          A4 portrait, 4 kwartieren van 40 stickers (21×15&nbsp;mm) — 160
          stickers per vel.
        </p>
      </div>

      <section className="rounded-lg border p-6">
        <p className="text-sm text-muted-foreground">Laatst gebruikt</p>
        <p className="text-lg font-medium">
          {lastUsed > 0 ? String(lastUsed).padStart(4, "0") : "nog geen"}
        </p>
      </section>

      <StickerForm suggestedStart={suggestedStart} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Eerder gegenereerd
        </h2>
        {sheets.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Nog geen vellen. Begin hierboven.
          </div>
        ) : (
          <ul className="divide-y rounded-md border">
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
                    ? new Date(s.created_at).toLocaleString("nl-NL", {
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
