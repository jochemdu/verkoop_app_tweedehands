-- Phase 16: power features infrastructure (Feat 2/4/8/11/13/15/17)

-- Feat 17: containers (fysieke opslagplekken in huis)
CREATE TABLE IF NOT EXISTS containers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id),
  label           TEXT NOT NULL,
  location_text   TEXT,
  qr_code         TEXT UNIQUE,
  last_visited_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, label)
);
CREATE INDEX IF NOT EXISTS idx_containers_user ON containers(user_id);

ALTER TABLE products ADD COLUMN IF NOT EXISTS container_id UUID REFERENCES containers(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_photo_id UUID REFERENCES photos(id);

-- Feat 2: source_photo_id (self-ref niet mogelijk — link naar photos waaruit
-- sub-foto werd gecropt via multi-product mode)
ALTER TABLE photos ADD COLUMN IF NOT EXISTS cropped_from_photo_id UUID REFERENCES photos(id);

-- Feat 4: perceptual hash voor dedupe
ALTER TABLE photos ADD COLUMN IF NOT EXISTS phash BIGINT;
CREATE INDEX IF NOT EXISTS idx_photos_phash ON photos(phash) WHERE phash IS NOT NULL;

-- Feat 11: huis-video-scans
CREATE TABLE IF NOT EXISTS house_scans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) NOT NULL,
  container_id      UUID REFERENCES containers(id),
  video_storage_path TEXT NOT NULL,
  frame_count       INTEGER,
  detected_objects  JSONB DEFAULT '[]',
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_house_scans_user ON house_scans(user_id);

-- Feat 13: market trends cache
CREATE TABLE IF NOT EXISTS market_trends (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform     platform_slug NOT NULL,
  category     TEXT NOT NULL,
  trend_data   JSONB NOT NULL,
  sample_size  INTEGER,
  fetched_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  UNIQUE(platform, category)
);
CREATE INDEX IF NOT EXISTS idx_market_trends_expires ON market_trends(expires_at);

-- Feat 15: import candidates (camera roll scan results)
CREATE TABLE IF NOT EXISTS import_candidates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) NOT NULL,
  asset_id        TEXT NOT NULL,
  thumbnail_uri   TEXT,
  taken_at        TIMESTAMPTZ,
  detected_object TEXT,
  confidence      DECIMAL,
  matches_product_id UUID REFERENCES products(id),
  dismissed       BOOLEAN DEFAULT FALSE,
  imported        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, asset_id)
);
CREATE INDEX IF NOT EXISTS idx_import_candidates_user ON import_candidates(user_id) WHERE NOT dismissed AND NOT imported;

-- RLS voor nieuwe tabellen
ALTER TABLE containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE house_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_trends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_containers" ON containers;
CREATE POLICY "own_containers" ON containers FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_house_scans" ON house_scans;
CREATE POLICY "own_house_scans" ON house_scans FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_import_candidates" ON import_candidates;
CREATE POLICY "own_import_candidates" ON import_candidates FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "read_market_trends" ON market_trends;
CREATE POLICY "read_market_trends" ON market_trends FOR SELECT TO authenticated USING (true);

-- Hamming distance helper (aantal gezette bits in XOR)
CREATE OR REPLACE FUNCTION hamming_distance_bigint(a BIGINT, b BIGINT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COUNT(*)::INT
  FROM generate_series(0, 63) AS i
  WHERE ((a # b) >> i) & 1 = 1;
$$;

-- Find similar photos — voor Feat 4 dedupe query + Feat 15 album match.
CREATE OR REPLACE FUNCTION find_similar_photos(
  p_user_id UUID,
  p_phash BIGINT,
  p_max_distance INT DEFAULT 6,
  p_exclude_photo_id UUID DEFAULT NULL
)
RETURNS TABLE(photo_id UUID, product_id UUID, distance INT, storage_path TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    ph.id AS photo_id,
    ph.product_id,
    public.hamming_distance_bigint(ph.phash, p_phash) AS distance,
    ph.storage_path
  FROM public.photos ph
  WHERE
    ph.user_id = p_user_id
    AND ph.phash IS NOT NULL
    AND ph.deleted_at IS NULL
    AND (p_exclude_photo_id IS NULL OR ph.id != p_exclude_photo_id)
    AND public.hamming_distance_bigint(ph.phash, p_phash) <= p_max_distance
  ORDER BY distance ASC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION find_similar_photos(UUID, BIGINT, INT, UUID) TO authenticated;
