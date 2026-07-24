import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  FileText,
  PackageOpen,
  Tags,
  TrendingUp,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { localeTag } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";
import { formatEuro } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
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
    { data: aggRaw },
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
    // Fase 60: categorie/status/week/waarde-aggregaties in de DB (workspace-
    // gescopt via RLS) i.p.v. de volledige productset in geheugen.
    supabase.rpc("get_dashboard_aggregates"),
  ]);
  const s = stats as {
    total_products?: number;
    indexed_count?: number;
    ready_count?: number;
    listed_count?: number;
    sold_count?: number;
    total_est_value?: number;
  } | null;
  const agg = (aggRaw ?? {}) as {
    category_counts?: Record<string, number>;
    status_counts?: Record<string, number>;
    weekly?: Record<string, number>;
    realized?: number;
    potential?: number;
  };
  const totalProducts = s?.total_products ?? 0;
  const indexedCount = s?.indexed_count ?? 0;
  const readyCount = s?.ready_count ?? 0;
  const listedCount = s?.listed_count ?? 0;
  const soldCount = s?.sold_count ?? 0;

  // Categorieën pie
  const categoryData: CategoryCount[] = Object.entries(agg.category_counts ?? {})
    .map(([label, value]) => ({ label, value: Number(value) }))
    .sort((a, b) => b.value - a.value);

  // Status bar
  const statusCounts = agg.status_counts ?? {};
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
    .map((label) => ({ label, value: Number(statusCounts[label] ?? 0) }))
    .filter((s) => s.value > 0);

  // Weekly indexed (laatste 12 weken): skelet van 12 weken, gevuld uit de RPC.
  const weekly = agg.weekly ?? {};
  const now = new Date();
  const weeklyData: WeeklyPoint[] = [];
  for (let w = 11; w >= 0; w--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - w * 7);
    const key = isoWeekKey(d);
    weeklyData.push({ week: key, count: Number(weekly[key] ?? 0) });
  }

  // Splits de waarde in gerealiseerd (verkocht) vs voorraad-potentieel.
  const realizedValue = Number(agg.realized ?? 0);
  const potentialValue = Number(agg.potential ?? 0);

  // Geschatte waarde: uit materialized view (pre-aggregated) met fallback
  // naar de live aggregatie als de view nog niet gerefreshed is.
  const totalEstValue = s?.total_est_value
    ? Number(s.total_est_value)
    : realizedValue + potentialValue;

  // Trend: geïndexeerd deze week vs vorige week.
  const wLen = weeklyData.length;
  const thisWeek = wLen > 0 ? weeklyData[wLen - 1]!.count : 0;
  const prevWeek = wLen > 1 ? weeklyData[wLen - 2]!.count : 0;
  const weekDelta = thisWeek - prevWeek;

  const t = await getTranslations("dashboard");
  const tc = await getTranslations("categoryNames");
  const tps = await getTranslations("productStatus");
  const dateTag = localeTag(await getLocale());

  // Gelokaliseerde chart-labels (i.p.v. rauwe slugs/enums).
  const categoryChart = categoryData.map((d) => ({
    label: tc.has(d.label) ? tc(d.label) : d.label,
    value: d.value,
  }));
  const statusChart = statusData.map((d) => ({
    label: tps.has(d.label) ? tps(d.label) : d.label,
    value: d.value,
  }));

  const hasProducts = totalProducts > 0;

  const statTiles: Array<{
    label: string;
    value: number;
    href: string;
    hint?: string;
    accent?: boolean;
  }> = [
    { label: t("statTotal"), value: totalProducts, href: "/inventory" },
    { label: t("statIndexed"), value: indexedCount, href: "/inventory?status=indexed", hint: t("hintIndexed") },
    { label: t("statReady"), value: readyCount, href: "/inventory?status=ready_to_list", hint: t("hintReady") },
    { label: t("statListed"), value: listedCount, href: "/inventory?status=listed", hint: t("hintListed") },
    { label: t("statSold"), value: soldCount, href: "/inventory?status=sold", accent: true },
  ];

  return (
    <main className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>

      {!hasProducts ? (
        <EmptyState
          icon={PackageOpen}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={{ href: "/upload", label: t("emptyLink") }}
        />
      ) : (
        <>
          {/* Waarde-hero */}
          <section className="card flex flex-col gap-4 border-l-4 border-accent p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t("estValue")}</p>
              <p className="font-heading text-4xl font-bold tracking-tight text-accent [font-variant-numeric:tabular-nums] sm:text-5xl">
                {formatEuro(totalEstValue, dateTag)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("heroRealized")}:{" "}
                <span className="font-medium text-foreground">
                  {formatEuro(realizedValue, dateTag)}
                </span>
                {"  ·  "}
                {t("heroPotential")}:{" "}
                <span className="font-medium text-foreground">
                  {formatEuro(potentialValue, dateTag)}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              {weekDelta > 0 && (
                <span className="badge badge-success inline-flex items-center gap-1">
                  <TrendingUp className="size-3.5" aria-hidden />
                  +{weekDelta} {t("thisWeekLabel")}
                </span>
              )}
              <span className="hidden rounded-full bg-accent-soft p-3 text-accent sm:flex">
                <Banknote className="size-6" aria-hidden />
              </span>
            </div>
          </section>

          {/* Klikbare KPI-tegels → gefilterde inventaris */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {statTiles.map((tile) => (
              <Link
                key={tile.href}
                href={tile.href}
                className="stat-card card-hover block"
              >
                <p className="stat-label">{tile.label}</p>
                <p
                  className={`stat-value mt-1 text-3xl ${tile.accent ? "text-accent" : ""}`}
                >
                  {tile.value}
                </p>
                {tile.hint && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{tile.hint}</p>
                )}
              </Link>
            ))}
          </section>

          <DashboardCharts
            category={categoryChart}
            status={statusChart}
            weekly={weeklyData}
          />

          {recent && recent.length > 0 && (
            <section className="card p-5">
              <h2 className="section-title mb-3">{t("recent")}</h2>
              <ul className="-mx-2 text-sm">
                {recent.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/inventory/${p.sticker_id ?? p.id}`}
                      className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
                    >
                      <span className="w-16 font-mono text-xs text-muted-foreground">
                        {p.sticker_id ?? "—"}
                      </span>
                      <span className="flex-1 truncate font-medium">
                        {p.working_title ?? t("noTitle")}
                      </span>
                      {p.category_slug && (
                        <span className="badge badge-neutral hidden sm:inline-flex">
                          {tc.has(p.category_slug) ? tc(p.category_slug) : p.category_slug}
                        </span>
                      )}
                      {p.indexed_at && (
                        <span className="hidden w-24 text-right text-xs text-muted-foreground md:inline">
                          {relativeTime(p.indexed_at, dateTag)}
                        </span>
                      )}
                      <ArrowRight
                        className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Action
          href="/upload"
          title={t("actUploadTitle")}
          body={t("actUploadBody")}
          icon={UploadCloud}
        />
        <Action
          href="/stickers"
          title={t("actStickersTitle")}
          body={t("actStickersBody")}
          icon={Tags}
        />
        <Action
          href="/taxatie"
          title={t("actTaxatieTitle")}
          body={t("actTaxatieBody")}
          icon={FileText}
        />
      </section>
    </main>
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
      className="card card-hover group flex items-start gap-3 p-5"
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

// Relatieve tijd ("2 dagen geleden") gelokaliseerd via Intl.
function relativeTime(iso: string, tag: string): string {
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  const diffMs = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diffMs / 60000);
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  const weeks = Math.round(days / 7);
  if (Math.abs(weeks) < 5) return rtf.format(weeks, "week");
  return rtf.format(Math.round(days / 30), "month");
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
