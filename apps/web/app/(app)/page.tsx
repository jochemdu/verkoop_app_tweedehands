import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  FileText,
  Tags,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardCharts } from "./dashboard-charts";

type CategoryCount = { label: string; value: number };
type StatusCount = { label: string; value: number };
type WeeklyPoint = { week: string; count: number };

export default async function Dashboard() {
  const supabase = await createClient();

  // Fase 14: counts uit materialized view dashboard_stats (refresht elke 15
  // min via pg_cron). Vervangt 5 losse COUNT queries door 1 row-lookup.
  const [
    { data: stats },
    { data: recent },
    { data: allProducts },
  ] = await Promise.all([
    // Fase 31: per-user RPC i.p.v. directe matview-select (matviews kennen
    // geen RLS; directe select lekte cross-tenant en brak bij >1 user).
    supabase.rpc("get_dashboard_stats").maybeSingle(),
    supabase
      .from("products")
      .select("id, sticker_id, working_title, category_slug, indexed_at")
      .is("deleted_at", null)
      .order("indexed_at", { ascending: false })
      .limit(5),
    supabase
      .from("products")
      .select("category_slug, status, indexed_at, sold_price, recommended_price")
      .is("deleted_at", null),
  ]);
  const s = stats as {
    total_products?: number;
    indexed_count?: number;
    ready_count?: number;
    listed_count?: number;
    sold_count?: number;
    total_est_value?: number;
  } | null;
  const totalProducts = s?.total_products ?? 0;
  const indexedCount = s?.indexed_count ?? 0;
  const readyCount = s?.ready_count ?? 0;
  const listedCount = s?.listed_count ?? 0;
  const soldCount = s?.sold_count ?? 0;

  // Categorieën pie
  const categoryMap = new Map<string, number>();
  (allProducts ?? []).forEach((p) => {
    const k = p.category_slug ?? "unknown";
    categoryMap.set(k, (categoryMap.get(k) ?? 0) + 1);
  });
  const categoryData: CategoryCount[] = [...categoryMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Status bar
  const statusMap = new Map<string, number>();
  (allProducts ?? []).forEach((p) => {
    const k = p.status ?? "indexed";
    statusMap.set(k, (statusMap.get(k) ?? 0) + 1);
  });
  const statusOrder = [
    "indexed",
    "analyzing",
    "ready_to_list",
    "pending_review",
    "approved",
    "listed",
    "sold",
    "archived",
  ];
  const statusData: StatusCount[] = statusOrder
    .map((s) => ({ label: s, value: statusMap.get(s) ?? 0 }))
    .filter((s) => s.value > 0);

  // Weekly indexed (laatste 12 weken)
  const weeksMap = new Map<string, number>();
  const now = new Date();
  for (let w = 11; w >= 0; w--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - w * 7);
    const key = isoWeekKey(d);
    weeksMap.set(key, 0);
  }
  (allProducts ?? []).forEach((p) => {
    if (!p.indexed_at) return;
    const key = isoWeekKey(new Date(p.indexed_at));
    if (weeksMap.has(key)) {
      weeksMap.set(key, (weeksMap.get(key) ?? 0) + 1);
    }
  });
  const weeklyData: WeeklyPoint[] = [...weeksMap.entries()].map(([week, count]) => ({
    week,
    count,
  }));

  // Geschatte waarde: uit materialized view (pre-aggregated) met fallback
  // naar on-the-fly als view nog niet gerefreshed.
  const totalEstValue = s?.total_est_value
    ? Number(s.total_est_value)
    : (allProducts ?? []).reduce((sum, p) => {
        const v = p.sold_price ?? p.recommended_price ?? 0;
        return sum + Number(v || 0);
      }, 0);

  return (
    <main className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Totaal" value={totalProducts ?? 0} />
        <Stat label="Indexed" value={indexedCount ?? 0} hint="klaar voor analyse" />
        <Stat label="Ready" value={readyCount ?? 0} hint="klaar voor listing" />
        <Stat label="Listed" value={listedCount ?? 0} hint="actieve ads" />
        <Stat label="Sold" value={soldCount ?? 0} accent />
      </section>

      <section className="card flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">
            Geschatte inventaris-waarde (sold of recommended_price)
          </p>
          <p className="mt-1 font-heading text-4xl font-bold tracking-tight text-accent">
            € {totalEstValue.toFixed(2).replace(".", ",")}
          </p>
        </div>
        <span className="hidden rounded-full bg-accent-soft p-3 text-accent sm:flex">
          <Banknote className="size-6" aria-hidden />
        </span>
      </section>

      <DashboardCharts
        category={categoryData}
        status={statusData}
        weekly={weeklyData}
      />

      <section className="card p-5">
        <h2 className="section-title mb-3">Recent geïndexeerd</h2>
        {!recent || recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nog niks geïndexeerd. Begin via{" "}
            <Link className="font-medium text-accent underline" href="/upload">
              bulk upload
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="w-16 font-mono text-xs text-muted-foreground">
                  {p.sticker_id ?? "—"}
                </span>
                <span className="flex-1 truncate">
                  {p.working_title ?? "(geen titel)"}
                </span>
                <span className="badge hidden bg-muted text-muted-foreground sm:inline-flex">
                  {p.category_slug}
                </span>
                <Link
                  href={`/inventory/${p.sticker_id ?? p.id}`}
                  className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  Bekijk
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Action
          href="/upload"
          title="Bulk upload"
          body="Sleep foto's → auto sticker-ID."
          icon={UploadCloud}
        />
        <Action
          href="/stickers"
          title="Print stickers"
          body="A4 stickervel genereren."
          icon={Tags}
        />
        <Action
          href="/taxatie"
          title="Taxatie dossier"
          body="PDF voor antiek-taxateur."
          icon={FileText}
        />
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-heading text-3xl font-bold tracking-tight ${accent ? "text-accent" : ""}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Action({
  href,
  title,
  body,
  icon: Icon,
}: {
  href: string;
  title: string;
  body: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="card group flex items-start gap-3 p-5 transition-colors hover:border-accent"
    >
      <span className="rounded-md bg-accent-soft p-2 text-accent">
        <Icon className="size-5" aria-hidden />
      </span>
      <span>
        <span className="flex items-center gap-1 font-medium">
          {title}
          <ArrowRight
            className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          />
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
      </span>
    </Link>
  );
}

// ISO week: "2026-W16"
function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
