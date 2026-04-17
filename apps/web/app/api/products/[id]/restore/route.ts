import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function identifierColumn(id: string): "sticker_id" | "id" {
  return /^\d{4}$/.test(id) ? "sticker_id" : "id";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const { data: productRow } = await supabase
    .from("products")
    .select("id")
    .eq(identifierColumn(id), id)
    .single();
  if (!productRow) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  await supabase.from("products").update({ deleted_at: null }).eq("id", productRow.id);
  await supabase
    .from("photos")
    .update({ deleted_at: null })
    .eq("product_id", productRow.id);
  await supabase
    .from("listings")
    .update({ deleted_at: null })
    .eq("product_id", productRow.id);
  return NextResponse.json({ restored: true });
}
