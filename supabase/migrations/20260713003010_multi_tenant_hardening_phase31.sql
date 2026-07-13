-- Fase 31: multi-tenant hardening.
-- 1. dashboard_stats afschermen per gebruiker (matviews kennen geen RLS).
-- 2. user_id-(composite)indexen op de hot tables voor RLS-queries.

-- ---------------------------------------------------------------------------
-- 1. Dashboard-stats per user via SECURITY DEFINER RPC.
--    De matview had GRANT SELECT TO authenticated → elke user kon álle rijen
--    (dus andermans aggregaten) lezen, en .maybeSingle() brak bij >1 user.
--    We trekken die grant in en geven alleen nog de eigen rij terug.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON dashboard_stats FROM authenticated;

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE(
  total_products BIGINT,
  indexed_count BIGINT,
  ready_count BIGINT,
  listed_count BIGINT,
  sold_count BIGINT,
  pending_count BIGINT,
  approved_count BIGINT,
  archived_count BIGINT,
  total_est_value NUMERIC,
  refreshed_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    total_products, indexed_count, ready_count, listed_count, sold_count,
    pending_count, approved_count, archived_count, total_est_value, refreshed_at
  FROM public.dashboard_stats
  WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Indexen op user_id (+ composite) — elke RLS-query filtert op
--    user_id = auth.uid(); zonder index is dat een seq scan + filter.
--    Partieel op deleted_at IS NULL omdat vrijwel elke query dat filtert.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_user_active
  ON products(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_user_status
  ON products(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_user_category
  ON products(user_id, category_slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_user_indexed
  ON products(user_id, indexed_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_claude_analyses_user ON claude_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_user ON price_history(user_id);
CREATE INDEX IF NOT EXISTS idx_taxatie_exports_user ON taxatie_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_sticker_sheets_user ON sticker_sheets(user_id);
CREATE INDEX IF NOT EXISTS idx_market_comparables_user ON market_comparables(user_id);
