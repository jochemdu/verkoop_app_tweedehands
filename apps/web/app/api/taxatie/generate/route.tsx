import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { aiRateLimit } from "@/lib/rate-limit";
import {
  TaxatieDossier,
  type TaxatieProduct,
} from "@/lib/pdf/taxatie-dossier";

export const runtime = "nodejs";

const bodySchema = z.object({
  product_ids: z.array(z.string().uuid()).min(1).max(100),
  bundle_id: z.string().uuid().optional(),
  recipient_name: z.string().max(200).optional(),
  recipient_email: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
  photos_per_product: z.number().int().min(0).max(8).default(4),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const rl = aiRateLimit(user.id, "taxatie");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Te veel zware verzoeken — wacht een paar minuten." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ongeldige invoer", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { product_ids, bundle_id, recipient_name, recipient_email, notes, photos_per_product } =
    parsed.data;

  // Haal productgegevens + photos op.
  const { data: productRows, error: productErr } = await supabase
    .from("products")
    .select(
      "id, sticker_id, title, working_title, category_slug, condition, specs, defects, provenance_notes, estimated_value_min, estimated_value_max, recommended_price",
    )
    .in("id", product_ids)
    .is("deleted_at", null);
  if (productErr || !productRows || productRows.length === 0) {
    return NextResponse.json(
      { error: "Geen producten gevonden voor de meegegeven IDs" },
      { status: 404 },
    );
  }

  // Photo-paden per product + signed URLs.
  const { data: photoRows } = await supabase
    .from("photos")
    .select("product_id, storage_path, photo_type, order_index")
    .in("product_id", product_ids)
    .order("order_index");
  const allPaths = (photoRows ?? []).map((p) => p.storage_path);
  const signed = allPaths.length > 0
    ? (await supabase.storage
        .from("product-photos")
        .createSignedUrls(allPaths, 3600)).data ?? []
    : [];
  const signedByPath = new Map<string, string>();
  signed.forEach((s, i) => {
    if (s.signedUrl && allPaths[i]) signedByPath.set(allPaths[i]!, s.signedUrl);
  });

  const seller = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "seller_name")
    .maybeSingle();
  const sellerName = (seller.data?.value as string | null) ?? undefined;

  // Mapped voor PDF-component: respecteer de volgorde uit product_ids.
  const idToProduct = new Map(productRows.map((p) => [p.id, p]));
  const products: TaxatieProduct[] = product_ids
    .map((id) => idToProduct.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      sticker_id: p.sticker_id,
      title: p.title,
      working_title: p.working_title,
      category_slug: p.category_slug,
      condition: p.condition,
      specs: (p.specs ?? null) as Record<string, unknown> | null,
      defects: p.defects,
      provenance_notes: p.provenance_notes,
      estimated_value_min: p.estimated_value_min == null ? null : Number(p.estimated_value_min),
      estimated_value_max: p.estimated_value_max == null ? null : Number(p.estimated_value_max),
      recommended_price: p.recommended_price == null ? null : Number(p.recommended_price),
      photos: (photoRows ?? [])
        .filter((ph) => ph.product_id === p.id)
        .slice(0, photos_per_product)
        .map((ph) => ({
          url: signedByPath.get(ph.storage_path) ?? "",
          photo_type: ph.photo_type,
        }))
        .filter((ph) => ph.url),
    }));

  const generatedAt = new Date();
  const buffer = await renderToBuffer(
    <TaxatieDossier
      seller_name={sellerName}
      recipient_name={recipient_name}
      recipient_email={recipient_email || undefined}
      notes={notes}
      products={products}
      generated_at={generatedAt}
    />,
  );

  const filename = `${user.id}/taxatie_${generatedAt.toISOString().replace(/[:.]/g, "-")}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from("taxatie-pdfs")
    .upload(filename, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json(
      { error: `Upload faalde: ${uploadErr.message}` },
      { status: 500 },
    );
  }

  // Registreer in taxatie_exports — 1 rij per export; koppel aan eerste product
  // of aan bundle_id indien meegegeven (DB constraint vereist minstens één van beide).
  const { data: exportRow, error: exportErr } = await supabase
    .from("taxatie_exports")
    .insert({
      product_id: bundle_id ? null : products[0] ? product_ids[0]! : null,
      bundle_id: bundle_id ?? null,
      pdf_storage_path: filename,
      recipient_name: recipient_name ?? null,
      recipient_email: recipient_email || null,
      user_id: user.id,
    })
    .select()
    .single();
  if (exportErr) {
    await supabase.storage.from("taxatie-pdfs").remove([filename]);
    return NextResponse.json(
      { error: `Export registreren faalde: ${exportErr.message}` },
      { status: 500 },
    );
  }

  const { data: signedUrl } = await supabase.storage
    .from("taxatie-pdfs")
    .createSignedUrl(filename, 3600);

  return NextResponse.json({
    export: exportRow,
    pdfUrl: signedUrl?.signedUrl,
    expiresInSeconds: 3600,
    products_included: products.length,
  });
}
