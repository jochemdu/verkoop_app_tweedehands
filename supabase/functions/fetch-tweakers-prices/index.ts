// Edge Function: fetch-tweakers-prices
// Input: { query: string, limit?: number (default 20, max 50) }
// Output: { query, fetched_at, count, results: [{ title, price_eur, condition, url, relative_age }] }
//
// Scrapt Tweakers V&A (vraag-en-aanbod) zoekresultaten. Tweakers heeft geen
// publieke API; we parsen de publieke zoekpagina-HTML met regex omdat een
// volledige DOM parser in Edge Functions niet nodig is voor deze simpele structuur.
// Respecteert robots.txt door alleen public search pages te fetchen en rate
// limiting aan de clientkant over te laten (één call per user interaction).

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: { query?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body moet JSON zijn" }, 400, corsHeaders);
  }

  const query = (body.query ?? "").trim();
  const limit = Math.max(1, Math.min(50, body.limit ?? 20));

  if (query.length < 2) {
    return json({ error: "query moet minstens 2 tekens zijn" }, 400, corsHeaders);
  }

  const url = `https://tweakers.net/aanbod/?keyword=${encodeURIComponent(query)}`;
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        // Realistic UA zodat Tweakers de request niet als bot blokkeert.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 VerkoopAssistent/0.1",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.5",
      },
    });
    if (!res.ok) {
      return json(
        { error: `Tweakers response ${res.status}` },
        502,
        corsHeaders,
      );
    }
    html = await res.text();
  } catch (err) {
    return json(
      { error: `Fetch faalde: ${err instanceof Error ? err.message : "unknown"}` },
      502,
      corsHeaders,
    );
  }

  // Tweakers V&A listing markup varieert. We extracten zo robuust mogelijk
  // met meerdere regex-poging per veld. Als Tweakers hun HTML wijzigt moeten
  // de regexes worden bijgewerkt.
  const results: Array<{
    title: string;
    price_eur: number | null;
    condition: string | null;
    url: string;
    relative_age: string | null;
  }> = [];

  // Match listing containers (typisch <li class="listing listing--..."> of <article>)
  const listingBlocks =
    html.match(
      /<(?:article|li)[^>]*class="[^"]*(?:listing|offer)[^"]*"[^>]*>[\s\S]*?<\/(?:article|li)>/g,
    ) ?? [];

  for (const block of listingBlocks) {
    if (results.length >= limit) break;

    const href = firstMatch(block, [
      /<a[^>]+href="(\/aanbod\/[^"]+)"/,
      /<a[^>]+href="(https:\/\/tweakers\.net\/aanbod\/[^"]+)"/,
    ]);
    if (!href) continue;

    const title = firstMatch(block, [
      /<a[^>]+class="[^"]*title[^"]*"[^>]*>([^<]+)</,
      /<h\d[^>]*>\s*<a[^>]*>([^<]+)</,
      /<a[^>]+href="\/aanbod\/[^"]+"[^>]*>([^<]{4,})</,
    ]);
    if (!title) continue;

    const priceStr = firstMatch(block, [
      /€\s*([\d.]+,\d{2})/,
      /class="[^"]*price[^"]*"[^>]*>[^<]*€\s*([\d.,]+)/,
    ]);
    const priceEur = priceStr ? parseDutchNumber(priceStr) : null;

    const condition = firstMatch(block, [
      /class="[^"]*condition[^"]*"[^>]*>([^<]+)</,
      /Staat:\s*<[^>]+>([^<]+)</,
    ]);

    const age = firstMatch(block, [
      /class="[^"]*date[^"]*"[^>]*>([^<]+)</,
      /geplaatst[^<]*<[^>]+>([^<]+)</i,
    ]);

    results.push({
      title: decodeHtml(title.trim()),
      price_eur: priceEur,
      condition: condition ? decodeHtml(condition.trim()) : null,
      url: href.startsWith("http") ? href : `https://tweakers.net${href}`,
      relative_age: age ? decodeHtml(age.trim()) : null,
    });
  }

  // Simpele statistieken zodat de caller snel een prijsindicatie heeft.
  const prices = results
    .map((r) => r.price_eur)
    .filter((p): p is number => p != null && p > 0);
  const stats =
    prices.length > 0
      ? {
          min: Math.min(...prices),
          max: Math.max(...prices),
          avg: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
          sample_size: prices.length,
        }
      : null;

  return json(
    {
      query,
      url,
      fetched_at: new Date().toISOString(),
      count: results.length,
      stats,
      results,
      note:
        results.length === 0
          ? "Geen resultaten of Tweakers heeft hun HTML gewijzigd — pas de regex patterns in de Edge Function aan."
          : undefined,
    },
    200,
    corsHeaders,
  );
});

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

function parseDutchNumber(s: string): number | null {
  // "1.234,56" → 1234.56
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&euro;/g, "€");
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
