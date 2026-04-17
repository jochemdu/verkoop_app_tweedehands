// Edge Function: lookup-tin-mark
// Input:  { mark_text: string, hints?: { year?: string; region?: string } }
// Output: structured info over Nederlandse tinmerken + best-effort scrape van
//         tinvereniging.nl / pewter-databases.
//
// NL tinmerken systeem:
// - Engelmerk (angel mark): hoogste kwaliteit (fine pewter)
// - Rozenkroontje: algemeen tinmerk 17e-19e eeuw
// - Stadskeurmerken: per stad een eigen symbool
// - Makerteken: initialen / naam van de tinnegieter
// - Kwaliteit-merken: "TIN", cijfers voor gehalte
//
// Best-effort scraping — TinVereniging database is niet altijd publiek.
// Returnt altijd structured response met zoek-URL's als fallback.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: { mark_text?: string; hints?: { year?: string; region?: string } };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body moet JSON zijn" }, 400, corsHeaders);
  }

  const markText = (body.mark_text ?? "").trim();
  if (markText.length < 1 || markText.length > 200) {
    return json(
      { error: "mark_text moet 1-200 tekens zijn" },
      400,
      corsHeaders,
    );
  }

  const nlContext = {
    kwaliteit_merken: {
      "engel": "Fine pewter — hoogste tingehalte (~96% tin), 17e-19e eeuw",
      "rozenkroontje": "Algemeen courant tinwerk, 17e-19e eeuw",
      "TIN": "Modern tinwerk (20e eeuw)",
      getal: "Numerieke code = gehalte-indicator",
    },
    merkteken_typen: {
      maker: "Initialen / naam van tinnegieter",
      stad: "Keurmerk per stad (bijv. Amsterdam heeft drie Andrieskruisen)",
      jaar: "Jaarletter (alfabet per cyclus van ~25 jaar)",
      huismerk: "Persoonlijk embleem van de tinnegieter (roos, engel, kroon, etc.)",
    },
    beruchte_centra_nl: [
      "Amsterdam",
      "Den Haag",
      "Leiden",
      "Utrecht",
      "Haarlem",
      "Groningen",
      "Leeuwarden",
      "Middelburg",
    ],
  };

  // Probeer publieke bronnen: tinvereniging.nl, zilver.nl (ook tin-info),
  // rijksmuseum.nl.
  const searchUrls = [
    `https://www.tinvereniging.nl/?s=${encodeURIComponent(markText)}`,
    `https://www.zilver.nl/?s=${encodeURIComponent(markText + " tin")}`,
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

      const articleBlocks =
        html.match(
          /<article[^>]*>[\s\S]*?<\/article>|<h[23][^>]*>[\s\S]*?<a[^>]+href="[^"]+"[^>]*>[^<]+<\/a>[\s\S]{0,800}/g,
        ) ?? [];
      for (const block of articleBlocks) {
        if (candidates.length >= 8) break;
        const hrefMatch = block.match(/href="(https?:\/\/[^"]+)"/);
        const titleMatch = block.match(/>([^<]{6,})<\/a>/);
        if (hrefMatch && titleMatch && hrefMatch[1] && titleMatch[1]) {
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
    } catch {
      // try next URL
    }
  }

  return json(
    {
      mark_text: markText,
      hints: body.hints,
      nl_context: nlContext,
      candidates,
      additional_sources: [
        {
          name: "TinVereniging",
          url: `https://www.tinvereniging.nl/?s=${encodeURIComponent(markText)}`,
          note: "Nederlandse Tinvereniging — kennisbank over tinmerken",
        },
        {
          name: "Pewter.org.uk marks database",
          url: `https://www.pewtersociety.org/knowledge-base/pewter-marks`,
          note: "UK context, maar veel EU-overlap; goed voor merkstijl-referentie",
        },
        {
          name: "Google Images",
          url: `https://www.google.com/search?tbm=isch&q=tinmerk+${encodeURIComponent(
            markText,
          )}`,
          note: "Visuele verificatie tegen bekende merktekens",
        },
      ],
      note:
        candidates.length === 0
          ? "Geen directe match gevonden in publieke NL databases. Tinmerken zijn vaak handmatig ingeslagen en variëren sterk — voor exacte attributie wordt aangeraden een professionele taxateur te raadplegen (via /taxatie in de web-app). Deel de macro-foto met Claude voor visuele analyse."
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
