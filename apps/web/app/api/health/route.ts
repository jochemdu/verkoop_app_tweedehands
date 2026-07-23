import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lichte readiness-check: bevestigt dat de app draait én de database bereikbaar
// is. Handig voor uptime-monitoring en om na een deploy snel te zien of de
// Supabase-verbinding/env klopt. Geen auth, geen data — alleen een goedkope
// count-query op een publieke referentietabel.
export async function GET() {
  const startedAt = Date.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("categories")
      .select("slug", { count: "exact", head: true });
    if (error) {
      return NextResponse.json(
        { status: "error", db: "down", error: error.message },
        { status: 503 },
      );
    }
    return NextResponse.json({
      status: "ok",
      db: "up",
      latencyMs: Date.now() - startedAt,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        db: "unknown",
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 503 },
    );
  }
}
