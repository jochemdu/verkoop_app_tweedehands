import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  PRODUCT_STATUSES,
  CATEGORY_SLUGS,
  type ProductStatus,
  type CategorySlug,
} from "@verkoopassistent/shared";
import { AddProductButton } from "./add-product-button";

type Search = {
  q?: string;
  status?: string;
  category?: string;
  sticker_from?: string;
  sticker_to?: string;
  page?: string;
  deleted?: string;
};

const PAGE_SIZE = 50;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const showDeleted = params.deleted === "1";
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("products")
    .select(
      "id, sticker_id, working_title, title, category_slug, status, indexed_at, deleted_at",
      { count: "exact" },
    )
    .order("indexed_at", { ascending: false })
    .range(from, to);

  if (showDeleted) {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
  }

  if (params.q) {
    query = query.or(
      `working_title.ilike.%${params.q}%,title.ilike.%${params.q}%,indexing_notes.ilike.%${params.q}%`,
    );
  }
  if (params.status && PRODUCT_STATUSES.includes(params.status as ProductStatus)) {
    query = query.eq("status", params.status as ProductStatus);
  }
  if (params.category && CATEGORY_SLUGS.includes(params.category as CategorySlug)) {
    query = query.eq("category_slug", params.category as CategorySlug);
  }
  if (params.sticker_from) {
    query = query.gte("sticker_id", params.sticker_from.padStart(4, "0"));
  }
  if (params.sticker_to) {
    query = query.lte("sticker_id", params.sticker_to.padStart(4, "0"));
  }

  const { data: products, count } = await query;
  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  const pageQueryParams = new URLSearchParams();
  if (params.q) pageQueryParams.set("q", params.q);
  if (params.status) pageQueryParams.set("status", params.status);
  if (params.category) pageQueryParams.set("category", params.category);
  if (params.sticker_from) pageQueryParams.set("sticker_from", params.sticker_from);
  if (params.sticker_to) pageQueryParams.set("sticker_to", params.sticker_to);
  if (showDeleted) pageQueryParams.set("deleted", "1");
  const buildPageUrl = (p: number) => {
    const q = new URLSearchParams(pageQueryParams);
    q.set("page", String(p));
    return `/inventory?${q.toString()}`;
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventaris</h1>
          <p className="text-sm text-muted-foreground">
            {count ?? 0} producten {showDeleted ? "(verwijderd)" : "totaal"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={showDeleted ? "/inventory" : "/inventory?deleted=1"}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            {showDeleted ? "← Actief" : "Prullenbak"}
          </Link>
          {!showDeleted && <AddProductButton />}
        </div>
      </div>

      <form className="grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-5">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Zoeken</span>
          <input
            name="q"
            defaultValue={params.q}
            placeholder="titel of notities"
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Status</span>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">(alle)</option>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Categorie</span>
          <select
            name="category"
            defaultValue={params.category ?? ""}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">(alle)</option>
            {CATEGORY_SLUGS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Sticker van</span>
          <input
            name="sticker_from"
            defaultValue={params.sticker_from}
            placeholder="0001"
            className="w-full rounded-md border px-2 py-1.5 text-sm font-mono"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Sticker tot</span>
          <input
            name="sticker_to"
            defaultValue={params.sticker_to}
            placeholder="0160"
            className="w-full rounded-md border px-2 py-1.5 text-sm font-mono"
          />
        </label>
        <div className="col-span-full flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            Filter
          </button>
          <Link href="/inventory" className="rounded-md border px-3 py-1.5 text-sm">
            Reset
          </Link>
        </div>
      </form>

      {!products || products.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Geen producten gevonden.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="p-3 font-medium">Sticker</th>
                  <th className="p-3 font-medium">Titel</th>
                  <th className="p-3 font-medium">Categorie</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Geïndexeerd</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{p.sticker_id ?? "—"}</td>
                    <td className="p-3">
                      {p.title ?? p.working_title ?? (
                        <span className="italic text-muted-foreground">(geen titel)</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{p.category_slug}</td>
                    <td className="p-3">
                      <span className="inline-flex rounded-full border px-2 py-0.5 text-xs">
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {p.indexed_at
                        ? new Date(p.indexed_at).toLocaleDateString("nl-NL", {
                            dateStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/inventory/${p.sticker_id ?? p.id}`}
                        className="text-xs underline"
                      >
                        Bekijk
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Pagina {page} van {totalPages} ({count} totaal)
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={buildPageUrl(page - 1)} className="rounded-md border px-2 py-1">
                  ← Vorige
                </Link>
              )}
              {page < totalPages && (
                <Link href={buildPageUrl(page + 1)} className="rounded-md border px-2 py-1">
                  Volgende →
                </Link>
              )}
            </div>
          </nav>
        </>
      )}
    </main>
  );
}
