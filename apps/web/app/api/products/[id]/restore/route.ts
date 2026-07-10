import { NextResponse, type NextRequest } from "next/server";
import { resolveProductId, restoreProducts } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
  let productId: string;
  try {
    productId = await resolveProductId(supabase, id);
  } catch {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  await restoreProducts(supabase, [productId]);
  return NextResponse.json({ restored: true });
}
