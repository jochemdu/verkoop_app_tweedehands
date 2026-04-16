import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { LISTING_STATUSES, type Database } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";

type ListingUpdate = Database["public"]["Tables"]["listings"]["Update"];

export const runtime = "nodejs";

const patchSchema = z.object({
  final_title: z.string().min(3).max(200).optional(),
  final_description: z.string().min(10).max(5000).optional(),
  price: z.number().nonnegative().optional(),
  shipping_price: z.number().nonnegative().optional(),
  status: z.enum(LISTING_STATUSES).optional(),
  listing_url: z.string().url().optional(),
  external_id: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ongeldige invoer", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const update: ListingUpdate = { ...parsed.data };
  // Markeer timestamps als status-overgang gebeurt.
  if (parsed.data.status === "approved") update.approved_at = new Date().toISOString();
  if (parsed.data.status === "published") update.published_at = new Date().toISOString();

  const { data: listing, error } = await supabase
    .from("listings")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error || !listing) {
    return NextResponse.json(
      { error: error?.message ?? "Niet gevonden" },
      { status: 404 },
    );
  }

  // Als status naar published gaat, bump ook product status.
  if (parsed.data.status === "published") {
    await supabase
      .from("products")
      .update({ status: "listed" })
      .eq("id", listing.product_id);
  }

  return NextResponse.json({ listing });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
