// Edge Function: lookup-ean
// Input: { ean: string }  (EAN-8 / EAN-13 / UPC-A)
// Output: { match: boolean, source?: string, product?: { name, brand, category, image_url } }
//
// Probeert Open Food Facts → Open Beauty Facts → Open Products Facts.
// Voor hardware/games/kaarten is vaak geen match; dan returnt match:false.
// Geen API keys nodig.

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: { ean?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body moet JSON zijn" }, 400, corsHeaders);
  }

  const ean = (body.ean ?? "").trim();
  if (!/^\d{8,14}$/.test(ean)) {
    return json(
      { error: "ean moet 8-14 cijfers zijn (EAN-8 / UPC-A / EAN-13 / ITF-14)" },
      400,
      corsHeaders,
    );
  }

  const sources: Array<{ name: string; url: string }> = [
    { name: "openfoodfacts", url: `https://world.openfoodfacts.org/api/v2/product/${ean}.json` },
    { name: "openbeautyfacts", url: `https://world.openbeautyfacts.org/api/v2/product/${ean}.json` },
    { name: "openproductsfacts", url: `https://world.openproductsfacts.org/api/v2/product/${ean}.json` },
  ];

  for (const src of sources) {
    try {
      const res = await fetch(src.url, {
        headers: { "User-Agent": "VerkoopAssistent/0.1 (+https://github.com/jochemdu/verkoop_app_tweedehands)" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status !== 1 || !data.product) continue;
      const p = data.product;
      return json(
        {
          match: true,
          source: src.name,
          ean,
          product: {
            name: p.product_name ?? p.generic_name ?? null,
            brand: p.brands ?? null,
            category: p.categories ?? p.categories_tags?.[0] ?? null,
            image_url: p.image_front_url ?? p.image_url ?? null,
            quantity: p.quantity ?? null,
          },
        },
        200,
        corsHeaders,
      );
    } catch {
      // Ga door naar volgende bron
    }
  }

  return json(
    {
      match: false,
      ean,
      note: "EAN niet gevonden in Open*Facts. Voor hardware/games/cards: probeer handmatig te identificeren via Claude + foto.",
    },
    200,
    corsHeaders,
  );
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
