import Link from "next/link";
import { Megaphone } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LISTING_STATUSES, localeTag, type ListingStatus } from "@verkoopassistent/shared";
import { formatEuro } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { ListingStatusBadge } from "@/components/status-badge";

type Search = {
  status?: string;
  platform?: string;
};

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select(
      "id, status, price, shipping_price, final_title, generated_title, created_at, published_at, listing_url, products(sticker_id, working_title, title), platforms(slug, name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (params.status && LISTING_STATUSES.includes(params.status as ListingStatus)) {
    query = query.eq("status", params.status as ListingStatus);
  }

  const { data: listings } = await query;

  // Status counts voor filter-badges.
  const { data: counts } = await supabase
    .from("listings")
    .select("status", { count: "exact" });
  const statusCounts: Record<string, number> = {};
  (counts ?? []).forEach((r) => {
    const s = r.status ?? "draft";
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  });

  const t = await getTranslations("listings");
  const dateTag = localeTag(await getLocale());
  const statusLabel = (s: string | null) => (s ? t(`st_${s}`) : "—");

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/listings"
          className={`chip ${!params.status ? "chip-active" : ""}`}
        >
          {t("all", { count: counts?.length ?? 0 })}
        </Link>
        {LISTING_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/listings?status=${s}`}
            className={`chip ${params.status === s ? "chip-active" : ""}`}
          >
            {statusLabel(s)} ({statusCounts[s] ?? 0})
          </Link>
        ))}
      </div>

      {!listings || listings.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
        />
      ) : (
        <>
        <div className="card hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="p-3 font-medium">{t("colSticker")}</th>
                <th className="p-3 font-medium">{t("colTitle")}</th>
                <th className="p-3 font-medium">{t("colPlatform")}</th>
                <th className="p-3 font-medium">{t("colPrice")}</th>
                <th className="p-3 font-medium">{t("colStatus")}</th>
                <th className="p-3 font-medium">{t("colCreated")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {listings.map((l) => {
                const product = Array.isArray(l.products) ? l.products[0] : l.products;
                const platform = Array.isArray(l.platforms) ? l.platforms[0] : l.platforms;
                return (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">
                      {product?.sticker_id ?? "—"}
                    </td>
                    <td className="p-3">
                      {l.final_title ?? l.generated_title ?? (
                        <span className="italic text-muted-foreground">
                          {t("noTitle")}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs">{platform?.name}</td>
                    <td className="p-3 font-mono text-xs [font-variant-numeric:tabular-nums]">
                      {formatEuro(l.price, dateTag)}
                    </td>
                    <td className="p-3">
                      <ListingStatusBadge status={l.status} />
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {l.created_at
                        ? new Date(l.created_at).toLocaleDateString(dateTag, {
                            dateStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <Link href={`/listings/${l.id}`} className="text-xs font-medium text-accent hover:underline">
                        {t("review")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobiel: kaarten i.p.v. de brede tabel (< sm). */}
        <div className="space-y-2 sm:hidden">
          {listings.map((l) => {
            const product = Array.isArray(l.products) ? l.products[0] : l.products;
            const platform = Array.isArray(l.platforms) ? l.platforms[0] : l.platforms;
            return (
              <Link
                key={l.id}
                href={`/listings/${l.id}`}
                className="card card-hover block p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {product?.sticker_id ?? "—"}
                  </span>
                  <ListingStatusBadge status={l.status} />
                </div>
                <p className="mt-1 truncate font-medium">
                  {l.final_title ?? l.generated_title ?? (
                    <span className="italic text-muted-foreground">{t("noTitle")}</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {platform?.name}
                  {" · "}
                  <span className="font-mono [font-variant-numeric:tabular-nums]">
                    {formatEuro(l.price, dateTag)}
                  </span>
                </p>
              </Link>
            );
          })}
        </div>
        </>
      )}
    </main>
  );
}
