import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  product_ids: z.array(z.string().uuid()).min(1).max(500),
  hard: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ongeldige invoer", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { product_ids, hard } = parsed.data;
  const now = new Date().toISOString();

  if (!hard) {
    await supabase
      .from("products")
      .update({ deleted_at: now })
      .in("id", product_ids);
    await supabase
      .from("photos")
      .update({ deleted_at: now })
      .in("product_id", product_ids);
    await supabase
      .from("listings")
      .update({ deleted_at: now })
      .in("product_id", product_ids);
    return NextResponse.json({ soft_deleted: product_ids.length });
  }

  // Hard-delete met storage cleanup.
  const { data: photos } = await supabase
    .from("photos")
    .select("storage_path")
    .in("product_id", product_ids);
  const paths = (photos ?? []).map((p) => p.storage_path);

  const { error } = await supabase.from("products").delete().in("id", product_ids);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (paths.length > 0) {
    await supabase.storage.from("product-photos").remove(paths);
  }
  return NextResponse.json({ hard_deleted: product_ids.length });
}
