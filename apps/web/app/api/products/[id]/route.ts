import { NextResponse, type NextRequest } from "next/server";
import {
  productUpdateSchema,
  productIdentifierColumn,
  resolveProductId,
  softDeleteProducts,
  hardDeleteProducts,
} from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

  // Sticker achteraf koppelen telt als handmatige invoer; de
  // UNIQUE(user_id, sticker_id) constraint vangt dubbele nummers.
  const update = parsed.data.sticker_id
    ? { ...parsed.data, sticker_input_method: "manual" as const }
    : parsed.data;

  const { data: product, error } = await supabase
    .from("products")
    .update(update)
    .eq(productIdentifierColumn(id), id)
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

// Soft-delete: zet deleted_at timestamp (cascade via shared repo-laag).
// Hard-delete via ?hard=true, incl. storage cleanup.
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

  let productId: string;
  try {
    productId = await resolveProductId(supabase, id);
  } catch {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  try {
    if (!hard) {
      await softDeleteProducts(supabase, [productId]);
      return NextResponse.json({
        soft_deleted: true,
        restore_url: `/api/products/${id}/restore`,
      });
    }
    await hardDeleteProducts(supabase, [productId]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete mislukt" },
      { status: 500 },
    );
  }
  return NextResponse.json({ hard_deleted: true });
}
