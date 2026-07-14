import { getTranslations } from "next-intl/server";

export type Comparable = {
  source: string;
  price: number | null;
  is_sold: boolean | null;
};

type SourceGroup = {
  source: string;
  activeCount: number;
  soldCount: number;
  min: number | null;
  max: number | null;
  avg: number | null;
};

// Aggregeer losse comps (market_comparables) per bron: actief vs verkocht +
// prijsrange en gemiddelde over alle comps met een prijs. Zo tonen we een
// breder, multi-source beeld naast de Tweakers-tijdreeks.
function aggregate(comps: Comparable[]): SourceGroup[] {
  const bySource = new Map<string, Comparable[]>();
  for (const c of comps) {
    const list = bySource.get(c.source) ?? [];
    list.push(c);
    bySource.set(c.source, list);
  }

  const groups: SourceGroup[] = [];
  for (const [source, list] of bySource) {
    const prices = list
      .map((c) => c.price)
      .filter((p): p is number => typeof p === "number");
    const avg =
      prices.length > 0
        ? prices.reduce((sum, p) => sum + p, 0) / prices.length
        : null;
    groups.push({
      source,
      activeCount: list.filter((c) => !c.is_sold).length,
      soldCount: list.filter((c) => c.is_sold).length,
      min: prices.length > 0 ? Math.min(...prices) : null,
      max: prices.length > 0 ? Math.max(...prices) : null,
      avg,
    });
  }
  // Meeste comps eerst.
  return groups.sort(
    (a, b) => b.activeCount + b.soldCount - (a.activeCount + a.soldCount),
  );
}

function euro(n: number): string {
  return `€${Math.round(n)}`;
}

export async function MarketComparables({ comps }: { comps: Comparable[] }) {
  const t = await getTranslations("comparables");
  const groups = aggregate(comps);

  return (
    <section className="card p-5">
      <h2 className="section-title">{t("title")}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("subtitle")}</p>
      {groups.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {groups.map((g) => (
            <li
              key={g.source}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div>
                <p className="font-medium capitalize">{g.source}</p>
                <p className="text-xs text-muted-foreground">
                  {g.activeCount} {t("active")} · {g.soldCount} {t("sold")}
                </p>
              </div>
              <div className="text-right text-sm">
                {g.min !== null && g.max !== null ? (
                  <>
                    <p className="font-mono">
                      {g.min === g.max
                        ? euro(g.min)
                        : `${euro(g.min)}–${euro(g.max)}`}
                    </p>
                    {g.avg !== null && (
                      <p className="text-xs text-muted-foreground">
                        {t("avg")} {euro(g.avg)}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">—</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
