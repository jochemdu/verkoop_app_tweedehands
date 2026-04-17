// Edge Function: price-watcher
// Draait op een pg_cron schema (elk uur) en checkt alle actieve price_watches
// die volgens hun check_interval_hours 'aan beurt' zijn. Voor elke due watch:
//   1. roept fetch-tweakers-prices aan met de watch's search_query
//   2. update price_watches.last_checked_at + current_lowest
//   3. append een rij in price_history met de sample stats
//   4. vlag een alert als lowest < alert_on_below
//
// verify_jwt = true → pg_cron moet service role JWT meesturen.
// Zie supabase/migrations/0002_price_watcher_cron.sql voor de cron-setup.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.50.0";

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: watches } = await supabase
    .from("price_watches")
    .select(
      "id, search_query, check_interval_hours, last_checked_at, target_price, current_lowest, alert_on_below",
    )
    .eq("is_active", true);

  const now = new Date();
  const due = (watches ?? []).filter((w) => {
    if (!w.last_checked_at) return true;
    const next = new Date(w.last_checked_at);
    next.setHours(next.getHours() + (w.check_interval_hours ?? 6));
    return now >= next;
  });

  const results: Array<{
    watch_id: string;
    hits: number;
    lowest?: number | null;
    alert?: boolean;
  }> = [];

  for (const w of due) {
    try {
      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/fetch-tweakers-prices`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ query: w.search_query, limit: 30 }),
        },
      );
      if (!res.ok) {
        results.push({ watch_id: w.id, hits: 0 });
        continue;
      }
      const data = await res.json();
      const lowest = data?.stats?.min ?? null;

      await supabase
        .from("price_watches")
        .update({ last_checked_at: now.toISOString(), current_lowest: lowest })
        .eq("id", w.id);

      if (data?.stats) {
        await supabase.from("price_history").insert({
          search_query: w.search_query,
          price_low: data.stats.min,
          price_avg: data.stats.avg,
          price_high: data.stats.max,
          sample_count: data.stats.sample_size,
          source_url: data.url,
        });
      }

      const alert =
        lowest != null &&
        w.alert_on_below != null &&
        lowest < Number(w.alert_on_below);
      results.push({ watch_id: w.id, hits: data?.count ?? 0, lowest, alert });
    } catch {
      results.push({ watch_id: w.id, hits: 0 });
    }
  }

  return new Response(
    JSON.stringify({
      checked: due.length,
      skipped: (watches?.length ?? 0) - due.length,
      results,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
