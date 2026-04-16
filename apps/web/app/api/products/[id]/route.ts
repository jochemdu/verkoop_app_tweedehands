import { NextResponse, type NextRequest } from "next/server";
import { productUpdateSchema } from "@verkoopassistent/shared";
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

  // Toegestane id: UUID of sticker_id. Resolve eerst naar UUID als nodig.
  const { data: product, error } = await supabase
    .from("products")
    .update(parsed.data)
    .eq(id.length === 4 ? "sticker_id" : "id", id)
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

export async function DELETE(
  _req: NextRequest,
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

  // Haal eerst photos op voor storage cleanup.
  const column = id.length === 4 ? "sticker_id" : "id";
  const { data: productRow } = await supabase
    .from("products")
    .select("id")
    .eq(column, id)
    .single();
  if (!productRow) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }
  const { data: photos } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("product_id", productRow.id);
  const paths = (photos ?? []).map((p) => p.storage_path);

  // CASCADE delete via FK verwijdert photos rijen automatisch.
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

  return NextResponse.json({ deleted: true });
}
