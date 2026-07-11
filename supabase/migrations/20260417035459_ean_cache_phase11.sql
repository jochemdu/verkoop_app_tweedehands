-- Feat 3: EAN cache tabel voor fast-track lookups
CREATE TABLE IF NOT EXISTS ean_cache (
  ean            TEXT PRIMARY KEY,
  source         TEXT,
  product_name   TEXT,
  brand          TEXT,
  category       TEXT,
  image_url      TEXT,
  raw_response   JSONB,
  cached_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at     TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days'
);
CREATE INDEX IF NOT EXISTS idx_ean_cache_expires ON ean_cache(expires_at);

-- Public read + authenticated write (solo user).
ALTER TABLE ean_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_ean_cache" ON ean_cache;
CREATE POLICY "read_ean_cache" ON ean_cache FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_ean_cache" ON ean_cache;
CREATE POLICY "write_ean_cache" ON ean_cache FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_ean_cache" ON ean_cache;
CREATE POLICY "update_ean_cache" ON ean_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
