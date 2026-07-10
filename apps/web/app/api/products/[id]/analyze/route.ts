import { NextResponse, type NextRequest } from "next/server";
import { productIdentifierColumn, signedPhotoUrls } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";
import { analyzeProductPhotos } from "@/lib/ai/analyze-product";

export const runtime = "nodejs";
// Vision-analyse kan even duren (adaptive thinking + meerdere foto's).
export const maxDuration = 300;

const MAX_PHOTOS = 6;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq(productIdentifierColumn(id), id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: "Product niet gevonden" }, { status: 404 });
  }

  // Signed URLs die het model kan ophalen. 15 min is ruim voldoende.
  let photoUrls: string[];
  try {
    const photos = await signedPhotoUrls(supabase, product.id, {
      expiresIn: 900,
      limit: MAX_PHOTOS,
    });
    photoUrls = photos.map((p) => p.url).filter((u): u is string => Boolean(u));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signed URLs mislukt" },
      { status: 500 },
    );
  }
  if (photoUrls.length === 0) {
    return NextResponse.json(
      { error: "Product heeft geen foto's om te analyseren." },
      { status: 400 },
    );
  }

  // Status → analyzing zolang de call loopt (dashboard/inventory tonen dit).
  await supabase
    .from("products")
    .update({ status: "analyzing" })
    .eq("id", product.id);

  try {
    const { analysis, model, usage } = await analyzeProductPhotos({
      workingTitle: product.working_title,
      indexingNotes: product.indexing_notes,
      ean: product.ean,
      stickerId: product.sticker_id,
      photoUrls,
    });

    // 1. Product bijwerken met analyse-resultaat.
    const { error: updateErr } = await supabase
      .from("products")
      .update({
        title: analysis.title,
        description: analysis.description,
        category_slug: analysis.category_slug,
        condition: analysis.condition,
        specs: Object.fromEntries(analysis.specs.map((s) => [s.key, s.value])),
        defects: analysis.defects,
        estimated_value_min: analysis.estimated_value_min,
        estimated_value_max: analysis.estimated_value_max,
        recommended_price: analysis.recommended_price,
        identified_via: "web_ai_pipeline",
        analyzed_at: new Date().toISOString(),
        status: "pending_review",
      })
      .eq("id", product.id);
    if (updateErr) throw new Error(`Product update mislukt: ${updateErr.message}`);

    // 2. Concept-advertentie op het voorkeursplatform van de categorie.
    const { data: category } = await supabase
      .from("categories")
      .select("preferred_platforms")
      .eq("slug", analysis.category_slug)
      .maybeSingle();
    const platformSlug = category?.preferred_platforms?.[0] ?? "marktplaats";
    const { data: platform } = await supabase
      .from("platforms")
      .select("id, slug")
      .eq("slug", platformSlug)
      .single();

    let listingId: string | null = null;
    if (platform) {
      const { data: listing } = await supabase
        .from("listings")
        .insert({
          product_id: product.id,
          platform_id: platform.id,
          status: "pending_review",
          price: analysis.recommended_price,
          shipping_price: 0,
          generated_title: analysis.title,
          generated_description: analysis.description,
          final_title: analysis.title,
          final_description: analysis.description,
          user_id: user.id,
        })
        .select("id")
        .maybeSingle();
      // Bestaat er al een listing voor dit platform (unique constraint), dan
      // laten we die met rust — de analyse staat op het product zelf.
      listingId = listing?.id ?? null;
    }

    // 3. Audit-log in claude_analyses (tabel bestond al, had nog geen writer).
    await supabase.from("claude_analyses").insert({
      analysis_type: "product_analysis",
      claude_source: "web_pipeline",
      user_prompt: `Analyse van product ${product.sticker_id ?? product.id} (${photoUrls.length} foto's, model ${model})`,
      claude_response: { analysis, usage } as never,
      subject_products: [product.id],
      applied: true,
      user_id: user.id,
    });

    return NextResponse.json({
      product_id: product.id,
      sticker_id: product.sticker_id,
      listing_id: listingId,
      analysis,
      model,
    });
  } catch (err) {
    // Status terugzetten zodat het product niet in 'analyzing' blijft hangen.
    await supabase
      .from("products")
      .update({ status: product.status ?? "indexed" })
      .eq("id", product.id);
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
