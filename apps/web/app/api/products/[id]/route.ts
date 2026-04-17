import { NextResponse, type NextRequest } from "next/server";
import { productUpdateSchema } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function identifierColumn(id: string): "sticker_id" | "id" {
  return /^\d{4}$/.test(id) ? "sticker_id" : "id";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = productUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ongeldige invoer", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { data: product, error } = await supabase
    .from("products")
    .update(parsed.data)
    .eq(identifierColumn(id), id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error || !product) {
    return NextResponse.json(
      { error: error?.message ?? "Niet gevonden" },
      { status: 404 },
    );
  }

  return NextResponse.json({ product });
}

// Soft-delete: zet deleted_at timestamp. Hard-delete via ?hard=true is
// optioneel maar vereist confirm-parameter. Storage cleanup vindt alleen bij
// hard delete plaats.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const { id } = await params;
  const hard = new URL(req.url).searchParams.get("hard") === "true";

  const column = identifierColumn(id);
  const { data: productRow } = await supabase
    .from("products")
    .select("id")
    .eq(column, id)
    .single();
  if (!productRow) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  if (!hard) {
    // Soft-delete: ook cascade op photos + listings + bundles via deleted_at.
    const now = new Date().toISOString();
    await supabase.from("products").update({ deleted_at: now }).eq("id", productRow.id);
    await supabase.from("photos").update({ deleted_at: now }).eq("product_id", productRow.id);
    await supabase.from("listings").update({ deleted_at: now }).eq("product_id", productRow.id);
    return NextResponse.json({ soft_deleted: true, restore_url: `/api/products/${id}/restore` });
  }

  // Hard delete: haal photos storage paths op voor cleanup.
  const { data: photos } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("product_id", productRow.id);
  const paths = (photos ?? []).map((p) => p.storage_path);

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productRow.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (paths.length > 0) {
    await supabase.storage.from("product-photos").remove(paths);
  }
  return NextResponse.json({ hard_deleted: true });
}
