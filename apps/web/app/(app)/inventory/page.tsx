import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  PRODUCT_STATUSES,
  sanitizeIlikeQuery,
  type ProductStatus,
} from "@verkoopassistent/shared";
import { AddProductButton } from "./add-product-button";
import { VirtualTable } from "./virtual-table";

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

  const q = params.q ? sanitizeIlikeQuery(params.q) : "";
  if (q) {
    query = query.or(
      `working_title.ilike.%${q}%,title.ilike.%${q}%,indexing_notes.ilike.%${q}%`,
    );
  }
  if (params.status && PRODUCT_STATUSES.includes(params.status as ProductStatus)) {
    query = query.eq("status", params.status as ProductStatus);
  }
  if (params.category && /^[a-z0-9_]+$/.test(params.category)) {
    query = query.eq("category_slug", params.category);
  }
  if (params.sticker_from) {
    query = query.gte("sticker_id", params.sticker_from.padStart(4, "0"));
  }
  if (params.sticker_to) {
    query = query.lte("sticker_id", params.sticker_to.padStart(4, "0"));
  }

  const [{ data: products, count }, { data: categories }] = await Promise.all([
    query,
    supabase.from("categories").select("slug, name").order("name"),
  ]);
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
          <h1 className="text-3xl font-bold tracking-tight">Inventaris</h1>
          <p className="text-sm text-muted-foreground">
            {count ?? 0} producten {showDeleted ? "(verwijderd)" : "totaal"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={showDeleted ? "/inventory" : "/inventory?deleted=1"}
            className="btn btn-outline"
          >
            {showDeleted ? "← Actief" : "Prullenbak"}
          </Link>
          {!showDeleted && <AddProductButton />}
        </div>
      </div>

      <form className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-5">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Zoeken</span>
          <input
            name="q"
            defaultValue={params.q}
            placeholder="titel of notities"
            className="input"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Status</span>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="input"
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
            className="input"
          >
            <option value="">(alle)</option>
            {(categories ?? []).map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
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
            className="input font-mono"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Sticker tot</span>
          <input
            name="sticker_to"
            defaultValue={params.sticker_to}
            placeholder="0160"
            className="input font-mono"
          />
        </label>
        <div className="col-span-full flex gap-2">
          <button
            type="submit"
            className="btn btn-accent"
          >
            Filter
          </button>
          <Link href="/inventory" className="btn btn-outline">
            Reset
          </Link>
        </div>
      </form>

      {!products || products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Geen producten gevonden.
        </div>
      ) : (
        <>
          <VirtualTable rows={products} enableActions={!showDeleted} />

          <nav className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Pagina {page} van {totalPages} ({count} totaal)
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={buildPageUrl(page - 1)} className="btn btn-outline px-2 py-1 text-xs">
                  ← Vorige
                </Link>
              )}
              {page < totalPages && (
                <Link href={buildPageUrl(page + 1)} className="btn btn-outline px-2 py-1 text-xs">
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
