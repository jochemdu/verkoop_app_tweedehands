import { NextResponse, type NextRequest } from "next/server";
import { lookupEan, lookupBook } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Provider-agnostische lookup endpoint: dezelfde logica als de Supabase Edge
// Functions, maar dan in de web-app zelf (packages/shared/src/lookups.ts).
// GET /api/lookup/ean?code=8712345678901
// GET /api/lookup/book?code=9789021462523
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { type } = await params;
  const code = new URL(req.url).searchParams.get("code")?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ error: "?code= parameter ontbreekt" }, { status: 400 });
  }

  try {
    if (type === "book") {
      return NextResponse.json(await lookupBook(code));
    }
    if (type !== "ean") {
      return NextResponse.json(
        { error: `Onbekend lookup-type '${type}' (gebruik ean of book)` },
        { status: 404 },
      );
    }

    // EAN: eerst de cache (90 dagen), anders live lookup + cache-write.
    const { data: cached } = await supabase
      .from("ean_cache")
      .select("*")
      .eq("ean", code)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached) {
      return NextResponse.json({
        match: Boolean(cached.product_name),
        source: `${cached.source} (cache)`,
        ean: cached.ean,
        product: {
          name: cached.product_name,
          brand: cached.brand,
          category: cached.category,
          image_url: cached.image_url,
          quantity: null,
        },
      });
    }

    const result = await lookupEan(code);
    if (result.match) {
      await supabase.from("ean_cache").upsert({
        ean: result.ean,
        source: result.source,
        product_name: result.product.name,
        brand: result.product.brand,
        category: result.product.category,
        image_url: result.product.image_url,
        raw_response: result as never,
        cached_at: new Date().toISOString(),
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lookup mislukt" },
      { status: 400 },
    );
  }
}
