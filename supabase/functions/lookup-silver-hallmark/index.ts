// Edge Function: lookup-silver-hallmark
// Input:  { mark_text: string, country_hint?: "NL" | "UK" | "DE" | "FR" | "other" }
// Output: structured info over Nederlandse zilvermerken + best-effort scrape van
//         Zilver.nl / De Nederlandsche Bank zoekresultaten.
//
// NL zilvermerken systeem (kort):
// - Gehaltemerk: 925 / 835 / 800 (getal)
// - Leeuw-keurmerk: garandeert gehalte
// - Meesterteken: persoonlijk merk van de zilversmid
// - Jaarletter: letter voor productiejaar
// - Kantoormerken: stadssymbool (Amsterdam = 3 Andrieskruisen, etc.)
//
// Scraping is best-effort — Nederlandse zilvermerken-databases zijn klein en
// hun HTML structuur wijzigt zonder aankondiging. Returnt altijd een structured
// response zodat Claude verder kan onderzoeken via de meegegeven URL's.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: { mark_text?: string; country_hint?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body moet JSON zijn" }, 400, corsHeaders);
  }

  const markText = (body.mark_text ?? "").trim();
  if (markText.length < 1 || markText.length > 100) {
    return json(
      { error: "mark_text moet 1-100 tekens zijn" },
      400,
      corsHeaders,
    );
  }

  // Nederlandse zilvermerken conventies voor context.
  const nlContext = {
    gehaltemerken: {
      "925": "sterling, minimum zilvergehalte 925/1000",
      "835": "zilver, 835/1000 (typisch voor NL bestek na 1953)",
      "800": "zilver, 800/1000 (vroeger courant, nu zeldzaam)",
    },
    leeuw_keurmerk:
      "Staande / lopende leeuw = NL waarborgmerk, gegarandeerd gehalte",
    kantoormerken_nl: {
      amsterdam: "drie Andrieskruisen",
      den_haag: "ooievaar",
      rotterdam: "paal omringd door leeuwen",
      utrecht: "utrechts wapen",
      groningen: "halve adelaar",
      leeuwarden: "fries wapen",
    },
  };

  // Probeer Zilver.nl zoek-URL met de mark_text als query.
  // Zilver.nl heeft een meestertekens-zoekfunctie maar de exacte query-URL is
  // niet stabiel; we proberen enkele varianten.
  const searchUrls = [
    `https://www.zilver.nl/?s=${encodeURIComponent(markText)}`,
    `https://www.zilver.nl/meestertekens/?q=${encodeURIComponent(markText)}`,
  ];

  const candidates: Array<{ url: string; title: string; excerpt?: string }> = [];

  for (const url of searchUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; VerkoopAssistent/0.1; +https://github.com/jochemdu/verkoop_app_tweedehands)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "nl-NL,nl;q=0.9",
        },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Extract search result links (heuristic: artikel titels + excerpts).
      const articleBlocks =
        html.match(
          /<article[^>]*>[\s\S]*?<\/article>|<h[23][^>]*>[\s\S]*?<a[^>]+href="[^"]+"[^>]*>[^<]+<\/a>[\s\S]{0,800}/g,
        ) ?? [];
      for (const block of articleBlocks) {
        if (candidates.length >= 8) break;
        const hrefMatch = block.match(/href="(https?:\/\/[^"]+)"/);
        const titleMatch = block.match(/>([^<]{6,})<\/a>/);
        if (hrefMatch && titleMatch && hrefMatch[1] && titleMatch[1]) {
          // Dedup op URL
          if (candidates.some((c) => c.url === hrefMatch[1])) continue;
          const excerptMatch = block.match(/<p[^>]*>([^<]{20,300})</);
          candidates.push({
            url: hrefMatch[1],
            title: decodeHtml(titleMatch[1].trim()),
            excerpt: excerptMatch && excerptMatch[1]
              ? decodeHtml(excerptMatch[1].trim())
              : undefined,
          });
        }
      }
      if (candidates.length > 0) break;
    } catch {
      // try next URL
    }
  }

  return json(
    {
      mark_text: markText,
      country_hint: body.country_hint ?? "NL",
      nl_context: nlContext,
      candidates,
      additional_sources: [
        {
          name: "Zilver.nl meestertekens",
          url: `https://www.zilver.nl/?s=${encodeURIComponent(markText)}`,
          note: "Primaire Nederlandse zilvermerken-database",
        },
        {
          name: "Rijksmuseum collectie (zilver)",
          url: `https://www.rijksmuseum.nl/nl/zoeken?q=${encodeURIComponent(
            markText,
          )}+zilver`,
          note: "Voor historische context en vergelijkbare stukken",
        },
        {
          name: "Google Images",
          url: `https://www.google.com/search?tbm=isch&q=zilvermerk+${encodeURIComponent(
            markText,
          )}`,
          note: "Visuele verificatie tegen bekende merktekens",
        },
      ],
      note:
        candidates.length === 0
          ? "Geen directe match gevonden. De structuur van Zilver.nl wijzigt af en toe — gebruik de zoek-URL's in additional_sources voor handmatige verificatie. Deel een macro-foto van het merk met Claude voor visuele analyse."
          : undefined,
    },
    200,
    corsHeaders,
  );
});

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
