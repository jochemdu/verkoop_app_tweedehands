-- Phase 14: performance
-- 1. Materialized view voor dashboard stats (5 COUNT queries → 1 lookup)
-- 2. DB function inventory_with_counts (N+1 fix voor MCP list_inventory)

-- 1. Dashboard stats materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_stats AS
SELECT
  user_id,
  COUNT(*) AS total_products,
  COUNT(*) FILTER (WHERE status = 'indexed') AS indexed_count,
  COUNT(*) FILTER (WHERE status = 'ready_to_list') AS ready_count,
  COUNT(*) FILTER (WHERE status = 'listed') AS listed_count,
  COUNT(*) FILTER (WHERE status = 'sold') AS sold_count,
  COUNT(*) FILTER (WHERE status = 'pending_review') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
  COUNT(*) FILTER (WHERE status = 'archived') AS archived_count,
  COALESCE(SUM(COALESCE(sold_price, recommended_price, 0)), 0) AS total_est_value,
  NOW() AS refreshed_at
FROM products
WHERE deleted_at IS NULL
GROUP BY user_id;

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_stats_user_idx ON dashboard_stats(user_id);

-- Refresh functie. CONCURRENTLY vereist de unique index hierboven.
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.dashboard_stats;
END $$;

GRANT SELECT ON dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_dashboard_stats() TO authenticated;

-- Eerste refresh zodat de view data heeft.
REFRESH MATERIALIZED VIEW dashboard_stats;

-- Schedule refresh elke 15 min via pg_cron. Verwijder bestaand schedule idempotent.
SELECT cron.unschedule('dashboard-stats-refresh')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dashboard-stats-refresh');

SELECT cron.schedule(
  'dashboard-stats-refresh',
  '*/15 * * * *',
  $$SELECT public.refresh_dashboard_stats();$$
);

-- 2. RPC voor list_inventory die photo_count efficiënt returnt via 1 JOIN
--    i.p.v. correlated subquery per rij (N+1 fix).
CREATE OR REPLACE FUNCTION list_inventory_with_counts(
  p_user_id UUID,
  p_status TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_sticker_from TEXT DEFAULT NULL,
  p_sticker_to TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  sticker_id TEXT,
  working_title TEXT,
  title TEXT,
  category_slug TEXT,
  status TEXT,
  indexed_at TIMESTAMPTZ,
  photo_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.sticker_id,
    p.working_title,
    p.title,
    p.category_slug::text,
    p.status::text,
    p.indexed_at,
    COALESCE(pc.cnt, 0) AS photo_count
  FROM public.products p
  LEFT JOIN (
    SELECT product_id, COUNT(*) AS cnt
    FROM public.photos
    WHERE deleted_at IS NULL
    GROUP BY product_id
  ) pc ON pc.product_id = p.id
  WHERE
    p.deleted_at IS NULL
    AND p.user_id = p_user_id
    AND (p_status IS NULL OR p.status::text = p_status)
    AND (p_category IS NULL OR p.category_slug::text = p_category)
    AND (p_sticker_from IS NULL OR p.sticker_id >= p_sticker_from)
    AND (p_sticker_to IS NULL OR p.sticker_id <= p_sticker_to)
  ORDER BY p.indexed_at DESC NULLS LAST
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION list_inventory_with_counts(UUID, TEXT, TEXT, TEXT, TEXT, INT) TO authenticated;
