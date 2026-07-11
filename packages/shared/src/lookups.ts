// Product-lookups tegen publieke bronnen. Pure fetch — geen Deno, geen
// Supabase — zodat web API routes, de MCP server én de Edge Functions
// dezelfde implementatie (kunnen) delen i.p.v. drie kopieën.

const UA = "VerkoopAssistent/0.1 (+https://github.com/jochemdu/verkoop_app_tweedehands)";

export type EanLookupResult =
  | {
      match: true;
      source: string;
      ean: string;
      product: {
        name: string | null;
        brand: string | null;
        category: string | null;
        image_url: string | null;
        quantity: string | null;
      };
    }
  | { match: false; ean: string; note: string };

// Open Food Facts → Open Beauty Facts → Open Products Facts.
// Voor hardware/games/kaarten is vaak geen match; dan match:false.
export async function lookupEan(eanRaw: string): Promise<EanLookupResult> {
  const ean = eanRaw.trim();
  if (!/^\d{8,14}$/.test(ean)) {
    throw new Error("ean moet 8-14 cijfers zijn (EAN-8 / UPC-A / EAN-13 / ITF-14)");
  }

  const sources = [
    { name: "openfoodfacts", url: `https://world.openfoodfacts.org/api/v2/product/${ean}.json` },
    { name: "openbeautyfacts", url: `https://world.openbeautyfacts.org/api/v2/product/${ean}.json` },
    { name: "openproductsfacts", url: `https://world.openproductsfacts.org/api/v2/product/${ean}.json` },
  ];

  for (const src of sources) {
    try {
      const res = await fetch(src.url, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        status?: number;
        product?: Record<string, unknown> & { categories_tags?: string[] };
      };
      if (data.status !== 1 || !data.product) continue;
      const p = data.product;
      return {
        match: true,
        source: src.name,
        ean,
        product: {
          name: (p.product_name ?? p.generic_name ?? null) as string | null,
          brand: (p.brands ?? null) as string | null,
          category: (p.categories ?? p.categories_tags?.[0] ?? null) as string | null,
          image_url: (p.image_front_url ?? p.image_url ?? null) as string | null,
          quantity: (p.quantity ?? null) as string | null,
        },
      };
    } catch {
      // volgende bron proberen
    }
  }

  return {
    match: false,
    ean,
    note: "EAN niet gevonden in Open*Facts. Voor hardware/games/cards: probeer handmatig te identificeren via de AI-analyse of Claude.",
  };
}

export type BookLookupResult =
  | {
      match: true;
      source: "google_books";
      isbn: string;
      book: {
        title: string | null;
        subtitle: string | null;
        authors: string[];
        publisher: string | null;
        year: number | null;
        language: string | null;
        image_url: string | null;
        page_count: number | null;
        categories: string[];
        isbn10: string | undefined;
        isbn13: string | undefined;
        description: string | null;
      };
    }
  | { match: false; isbn: string; note: string };

// Google Books API — gratis 1000 req/dag zonder key.
export async function lookupBook(isbnRaw: string): Promise<BookLookupResult> {
  const isbn = isbnRaw.replace(/[-\s]/g, "").trim();
  if (!/^\d{9,13}X?$/i.test(isbn)) {
    throw new Error("isbn moet 9-13 cijfers zijn");
  }

  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    return { match: false, isbn, note: `Google Books response ${res.status}` };
  }
  const data = (await res.json()) as {
    items?: Array<{ volumeInfo?: Record<string, unknown> }>;
  };
  const v = data.items?.[0]?.volumeInfo as
    | (Record<string, unknown> & {
        industryIdentifiers?: Array<{ type: string; identifier: string }>;
        imageLinks?: { thumbnail?: string; smallThumbnail?: string };
      })
    | undefined;
  if (!v) {
    return {
      match: false,
      isbn,
      note: "Geen Google Books match. Probeer handmatig of via de AI-analyse.",
    };
  }
  const identifiers = v.industryIdentifiers ?? [];
  return {
    match: true,
    source: "google_books",
    isbn,
    book: {
      title: (v.title ?? null) as string | null,
      subtitle: (v.subtitle ?? null) as string | null,
      authors: (v.authors ?? []) as string[],
      publisher: (v.publisher ?? null) as string | null,
      year: v.publishedDate ? parseInt(String(v.publishedDate), 10) : null,
      language: (v.language ?? null) as string | null,
      image_url: v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? null,
      page_count: (v.pageCount ?? null) as number | null,
      categories: (v.categories ?? []) as string[],
      isbn10: identifiers.find((i) => i.type === "ISBN_10")?.identifier,
      isbn13: identifiers.find((i) => i.type === "ISBN_13")?.identifier,
      description: v.description ? String(v.description).slice(0, 1000) : null,
    },
  };
}
