import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { softDeleteProducts, hardDeleteProducts } from "@verkoopassistent/shared";
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

  try {
    if (!hard) {
      const result = await softDeleteProducts(supabase, product_ids);
      return NextResponse.json({ soft_deleted: result.soft_deleted });
    }
    const result = await hardDeleteProducts(supabase, product_ids);
    return NextResponse.json({ hard_deleted: result.hard_deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete mislukt" },
      { status: 500 },
    );
  }
}
