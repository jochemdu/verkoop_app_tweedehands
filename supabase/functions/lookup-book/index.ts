// Feat 19: Google Books API lookup voor ISBN/EAN13 barcodes op boeken.
// Gratis tier: 1000 req/day zonder API key.
// Input: { isbn: string (9-13 cijfers) }
// Output: { match, source, book: { title, authors, publisher, year, ... } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: { isbn?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body moet JSON zijn" }, 400, corsHeaders);
  }

  const isbn = (body.isbn ?? "").replace(/[-\s]/g, "").trim();
  if (!/^\d{9,13}(X?)$/i.test(isbn)) {
    return json({ error: "isbn moet 9-13 cijfers zijn" }, 400, corsHeaders);
  }

  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "VerkoopAssistent/0.1" },
    });
    if (!res.ok) {
      return json(
        { match: false, isbn, note: `Google Books response ${res.status}` },
        200,
        corsHeaders,
      );
    }
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) {
      return json(
        {
          match: false,
          isbn,
          note: "Geen Google Books match. Probeer handmatig of via Claude.",
        },
        200,
        corsHeaders,
      );
    }
    const v = item.volumeInfo ?? {};
    const identifiers = (v.industryIdentifiers ?? []) as Array<{
      type: string;
      identifier: string;
    }>;
    const isbn10 = identifiers.find((i) => i.type === "ISBN_10")?.identifier;
    const isbn13 = identifiers.find((i) => i.type === "ISBN_13")?.identifier;

    return json(
      {
        match: true,
        source: "google_books",
        isbn,
        book: {
          title: v.title ?? null,
          subtitle: v.subtitle ?? null,
          authors: v.authors ?? [],
          publisher: v.publisher ?? null,
          year: v.publishedDate ? parseInt(v.publishedDate, 10) : null,
          language: v.language ?? null,
          image_url: v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? null,
          page_count: v.pageCount ?? null,
          categories: v.categories ?? [],
          isbn10,
          isbn13,
          description: v.description ? v.description.slice(0, 1000) : null,
        },
      },
      200,
      corsHeaders,
    );
  } catch (err) {
    return json(
      { error: `Fetch faalde: ${err instanceof Error ? err.message : "unknown"}` },
      502,
      corsHeaders,
    );
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
