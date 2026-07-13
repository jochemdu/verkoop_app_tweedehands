import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiRateLimit } from "@/lib/rate-limit";
import { runBlindSpotAudit } from "@/lib/ai/blind-spots";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const rl = aiRateLimit(user.id, "audit");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Te veel zware verzoeken — wacht een paar minuten." },
      { status: 429 },
    );
  }

  const [{ data: products }, { data: categories }, { data: profile }] =
    await Promise.all([
      supabase
        .from("products")
        .select("category_slug, title, working_title")
        .is("deleted_at", null),
      supabase.from("categories").select("slug, name"),
      supabase.from("profiles").select("household").eq("id", user.id).maybeSingle(),
    ]);

  const counts = new Map<string, number>();
  for (const p of products ?? []) {
    const k = p.category_slug ?? "unknown";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const categoryCounts = (categories ?? []).map((c) => ({
    slug: c.slug,
    name: c.name,
    count: counts.get(c.slug) ?? 0,
  }));
  const recentTitles = (products ?? [])
    .map((p) => p.title ?? p.working_title)
    .filter((t): t is string => Boolean(t))
    .slice(-30);

  try {
    const { audit, model, usage } = await runBlindSpotAudit({
      categoryCounts,
      recentTitles,
      household: (profile?.household as Record<string, unknown>) ?? {},
      categorySlugs: (categories ?? []).map((c) => c.slug),
    });

    await supabase.from("claude_analyses").insert({
      analysis_type: "blind_spot_audit",
      claude_source: "web_pipeline",
      user_prompt: `Blinde-vlekken-audit (${products?.length ?? 0} producten, model ${model})`,
      claude_response: { audit, usage } as never,
      applied: false,
      user_id: user.id,
    });

    return NextResponse.json({ audit, model });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Audit mislukt" },
      { status: 502 },
    );
  }
}
