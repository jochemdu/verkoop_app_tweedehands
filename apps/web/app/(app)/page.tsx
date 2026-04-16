import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();

  const [
    { count: totalProducts },
    { count: indexedCount },
    { count: readyCount },
    { data: recent },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("status", "indexed"),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("status", "ready_to_list"),
    supabase
      .from("products")
      .select("id, sticker_id, working_title, category_slug, indexed_at")
      .order("indexed_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <main className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Totaal producten" value={totalProducts ?? 0} />
        <Stat
          label="Klaar voor analyse"
          value={indexedCount ?? 0}
          hint="Status = indexed"
        />
        <Stat
          label="Klaar om te listen"
          value={readyCount ?? 0}
          hint="Status = ready_to_list"
        />
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent geïndexeerd
        </h2>
        {!recent || recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nog niks geïndexeerd. Begin via{" "}
            <Link className="underline" href="/upload">
              bulk upload
            </Link>{" "}
            of voeg een product toe op{" "}
            <Link className="underline" href="/inventory">
              Inventaris
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className="w-16 font-mono text-xs">
                  {p.sticker_id ?? "—"}
                </span>
                <span className="flex-1">
                  {p.working_title ?? "(geen titel)"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.category_slug}
                </span>
                <Link
                  href={`/inventory/${p.sticker_id ?? p.id}`}
                  className="text-xs underline"
                >
                  Bekijk
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Action
          href="/upload"
          title="Bulk foto upload"
          body="Sleep meerdere foto's vanaf je pc, ken sticker-ID's toe en maak producten aan."
        />
        <Action
          href="/stickers"
          title="Print stickervel"
          body="Genereer een A4 met 160 stickers om op je producten te plakken."
        />
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Action({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border p-5 transition hover:bg-muted"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </Link>
  );
}
