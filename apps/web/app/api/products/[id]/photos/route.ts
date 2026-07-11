import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSafeInboxPath, resolveProductId } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Foto's toevoegen aan een bestaand product — maakt stubs (kamer-scan,
// create_product_stub) afmaakbaar via de web-app. De client uploadt eerst
// naar {user_id}/inbox/… (zelfde conventie als bulk-upload) en meldt de
// paden hier aan.
const bodySchema = z.object({
  photo_paths: z.array(z.string().min(1)).min(1).max(20),
});

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
  let productId: string;
  try {
    productId = await resolveProductId(supabase, id);
  } catch {
    return NextResponse.json({ error: "Product niet gevonden" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige invoer" }, { status: 400 });
  }
  const { photo_paths } = parsed.data;
  if (!photo_paths.every((p) => isSafeInboxPath(p, user.id))) {
    return NextResponse.json(
      { error: "Storage pad hoort niet bij deze gebruiker" },
      { status: 403 },
    );
  }

  // Nieuwe foto's achteraan de bestaande volgorde.
  const { data: last } = await supabase
    .from("photos")
    .select("order_index")
    .eq("product_id", productId)
    .order("order_index", { ascending: false })
    .limit(1);
  const start = (last?.[0]?.order_index ?? -1) + 1;

  const rows = photo_paths.map((path, i) => ({
    product_id: productId,
    storage_path: path,
    order_index: start + i,
    photo_type: "general" as const,
    user_id: user.id,
  }));
  const { error } = await supabase.from("photos").insert(rows);
  if (error) {
    // Geen photo-rijen → ruim de zojuist geüploade files op (geen wezen).
    await supabase.storage.from("product-photos").remove(photo_paths);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ added: rows.length });
}
