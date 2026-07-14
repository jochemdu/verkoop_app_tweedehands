import { Package, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

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
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <ul className="card divide-y divide-border p-0">
          {bundles.map((bundle) => {
            const count = bundle.bundle_items?.length ?? 0;
            return (
              <li
                key={bundle.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Package
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {bundle.title || t("untitled")}
                </span>
                {bundle.suggested_by === "claude" && (
                  <span className="badge inline-flex items-center gap-1">
                    <Sparkles className="size-3" aria-hidden />
                    {t("bySuggested")}
                  </span>
                )}
                <span className="badge">{t("itemCount", { count })}</span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
