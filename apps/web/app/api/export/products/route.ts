import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const HEADERS = [
  "Sticker",
  "Titel",
  "Categorie",
  "Status",
  "Conditie",
  "Adviesprijs",
  "Verkoopprijs",
  "Verkocht op",
  "Geindexeerd",
  "Aangemaakt",
];

function escapeField(value: unknown): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { data: products } = await supabase
    .from("products")
    .select(
      "sticker_id, working_title, title, category_slug, status, condition, recommended_price, sold_price, sold_at, indexed_at, created_at",
    )
    .is("deleted_at", null)
    .order("indexed_at", { ascending: false });

  const rows = [HEADERS.map(escapeField).join(",")];
  for (const p of products ?? []) {
    rows.push(
      [
        p.sticker_id,
        p.title ?? p.working_title ?? "",
        p.category_slug,
        p.status,
        p.condition,
        p.recommended_price,
        p.sold_price,
        p.sold_at,
        p.indexed_at,
        p.created_at,
      ]
        .map(escapeField)
        .join(","),
    );
  }

  const csv = "\uFEFF" + rows.join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="verkoopassistent-export.csv"',
    },
  });
}
