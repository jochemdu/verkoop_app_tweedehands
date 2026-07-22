import Link from "next/link";
import { BellOff } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { localeTag } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { MarkAllReadButton, MarkReadButton } from "./mark-read";

export default async function AlertsPage() {
  const supabase = await createClient();
  const t = await getTranslations("alerts");
  const dateTag = localeTag(await getLocale());

  const { data: alerts } = await supabase
    .from("price_alerts")
    .select("id, product_id, search_query, lowest, threshold, created_at, read_at")
    .order("read_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(100);

  const hasUnread = (alerts ?? []).some((a) => !a.read_at);

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {hasUnread && <MarkAllReadButton />}
      </div>

      {!alerts || alerts.length === 0 ? (
        <EmptyState icon={BellOff} title={t("empty")} />
      ) : (
        <ul className="card divide-y divide-border">
          {alerts.map((a) => (
            <li
              key={a.id}
              className={`flex items-center justify-between gap-3 p-4 ${
                a.read_at
                  ? "opacity-60"
                  : "border-l-2 border-accent bg-accent-soft/30"
              }`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{a.search_query ?? t("noQuery")}</span>
                  {!a.read_at && (
                    <span className="badge shrink-0 bg-accent text-accent-foreground">
                      {t("unread")}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("line", {
                    lowest: Number(a.lowest ?? 0).toFixed(2),
                    threshold: Number(a.threshold ?? 0).toFixed(2),
                  })}
                </p>
                {a.created_at && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString(dateTag, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {a.product_id && (
                  <Link
                    href={`/inventory/${a.product_id}`}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {t("viewProduct")}
                  </Link>
                )}
                {!a.read_at && <MarkReadButton id={a.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
