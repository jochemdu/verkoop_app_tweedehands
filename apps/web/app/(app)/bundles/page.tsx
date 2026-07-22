import { Package, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";

export default async function BundlesPage() {
  const supabase = await createClient();
  const { data: bundles } = await supabase
    .from("bundles")
    .select("id, title, bundle_type, suggested_by, created_at, bundle_items(product_id)")
    .order("created_at", { ascending: false })
    .limit(100);

  const t = await getTranslations("bundles");

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {!bundles || bundles.length === 0 ? (
        <EmptyState icon={Package} title={t("empty")} />
      ) : (
        <ul className="card divide-y divide-border p-0">
          {bundles.map((bundle) => {
            const count = bundle.bundle_items?.length ?? 0;
            return (
              <li key={bundle.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Package className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {bundle.title || t("untitled")}
                </span>
                {bundle.suggested_by === "claude" && (
                  <span className="badge badge-accent inline-flex items-center gap-1">
                    <Sparkles className="size-3" aria-hidden />
                    {t("bySuggested")}
                  </span>
                )}
                <span className="badge badge-neutral">
                  {t("itemCount", { count })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
