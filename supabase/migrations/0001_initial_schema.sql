-- ─────────────────────────────────────────────────────────────────
-- VerkoopAssistent — 0001_initial_schema
-- Bron: PLAN.md (v2, sticker-systeem + Claude Desktop/MCP workflow).
-- Geen Claude Vision API, geen ai_* velden: Claude analyseert foto's via
-- MCP signed URLs in de conversatie.
-- ─────────────────────────────────────────────────────────────────

-- ═══ Extensies ═══════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ═══ Enum types ═══════════════════════════════════════════════════
CREATE TYPE product_condition AS ENUM (
  'mint', 'near_mint', 'excellent', 'very_good', 'good', 'fair', 'poor'
);

CREATE TYPE product_status AS ENUM (
  'indexed',
  'analyzing',
  'ready_to_list',
  'pending_review',
  'approved',
  'listed',
  'sold',
  'archived'
);

CREATE TYPE listing_status AS ENUM (
  'draft', 'pending_review', 'approved',
  'publishing', 'published', 'sold', 'expired', 'error'
);

CREATE TYPE photo_type AS ENUM (
  'general', 'front', 'back', 'mark', 'detail',
  'damage', 'serial', 'label', 'holo', 'barcode',
  'sticker'
);

CREATE TYPE sticker_input_method AS ENUM (
  'ocr_inline',
  'ocr_separate',
  'manual',
  'manual_increment'
);

CREATE TYPE platform_slug AS ENUM (
  'marktplaats', 'tweakers', 'cardmarket', 'ebay',
  'catawiki', '2dehands', 'facebook'
);

CREATE TYPE buyback_service_slug AS ENUM (
  'levelseven', 'nedgame', 'flashkaartshop',
  'rarecards', 'catchcollect', 'itad_broker', 'other'
);

CREATE TYPE category_slug AS ENUM (
  'ram_dimm', 'ram_sodimm', 'cpu', 'gpu',
  'console', 'console_game', 'smartphone', 'laptop',
  'pokemon_card', 'antique_tin', 'antique_silver',
  'antique_other', 'electronics_other', 'unknown', 'other'
);

CREATE TYPE bundle_type AS ENUM (
  'ram_kit', 'console_bundle', 'card_lot',
  'card_set', 'hardware_bundle', 'custom'
);

-- ═══ Shared trigger function ══════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══ Reference tables ═════════════════════════════════════════════

-- Sticker sheets (nieuw in v2)
CREATE TABLE sticker_sheets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_number     INTEGER NOT NULL,
  end_number       INTEGER NOT NULL,
  sheet_count      INTEGER DEFAULT 1,
  pdf_storage_path TEXT,
  printed_at       TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(start_number)
);

-- Platforms
CREATE TABLE platforms (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             platform_slug UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  base_url         TEXT,
  commission_rate  DECIMAL DEFAULT 0,
  fixed_fee        DECIMAL DEFAULT 0,
  api_available    BOOLEAN DEFAULT false,
  api_type         TEXT,
  supports_bulk    BOOLEAN DEFAULT false,
  is_active        BOOLEAN DEFAULT true
);

INSERT INTO platforms (slug, name, base_url, commission_rate, api_available, api_type) VALUES
  ('marktplaats', 'Marktplaats.nl', 'https://marktplaats.nl', 0, true, 'rest'),
  ('tweakers', 'Tweakers V&A', 'https://tweakers.net/aanbod', 0, false, 'scraping'),
  ('cardmarket', 'Cardmarket', 'https://cardmarket.com', 0.05, true, 'rest'),
  ('ebay', 'eBay', 'https://ebay.nl', 0.1153, true, 'rest'),
  ('catawiki', 'Catawiki', 'https://catawiki.nl', 0.125, false, 'manual'),
  ('2dehands', '2dehands.be', 'https://2dehands.be', 0, true, 'rest'),
  ('facebook', 'Facebook Marketplace', 'https://facebook.com/marketplace', 0, false, 'manual');

-- Buyback services
CREATE TABLE buyback_services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             buyback_service_slug UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  website_url      TEXT,
  specialization   TEXT,
  api_available    BOOLEAN DEFAULT false,
  typical_discount DECIMAL,
  is_active        BOOLEAN DEFAULT true,
  notes            TEXT
);

INSERT INTO buyback_services (slug, name, website_url, specialization, typical_discount) VALUES
  ('levelseven', 'Level Seven', 'https://levelseven.nl', 'retro_games', 0.55),
  ('nedgame', 'Nedgame', 'https://nedgame.nl/online-inruilen', 'retro_games', 0.50),
  ('flashkaartshop', 'Flashkaartshop', 'https://flashkaartshop.nl', 'retro_games', 0.60),
  ('rarecards', 'RareCards', 'https://rarecards.nl', 'pokemon_cards', 0.60),
  ('catchcollect', 'CatchCollect', 'https://catchcollect.nl', 'pokemon_cards', 0.55);

-- Categories (spec_schemas per categorie — zie PLAN.md sectie 4)
CREATE TABLE categories (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                       category_slug UNIQUE NOT NULL,
  name                       TEXT NOT NULL,
  parent_slug                category_slug REFERENCES categories(slug),
  spec_schema                JSONB DEFAULT '{}',
  preferred_platforms        platform_slug[] DEFAULT '{}',
  preferred_buyback_services buyback_service_slug[] DEFAULT '{}'
);

INSERT INTO categories (slug, name, spec_schema, preferred_platforms, preferred_buyback_services) VALUES
  ('ram_dimm', 'RAM DIMM', '{
    "generation": {"type": "enum", "values": ["DDR1","DDR2","DDR3","DDR4","DDR5"]},
    "capacity_gb": {"type": "number"},
    "speed_mhz": {"type": "number"},
    "brand": {"type": "string"},
    "ecc": {"type": "boolean"},
    "registered": {"type": "boolean"}
  }'::jsonb, ARRAY['marktplaats','tweakers']::platform_slug[], ARRAY[]::buyback_service_slug[]),

  ('ram_sodimm', 'RAM SODIMM (laptop)', '{
    "generation": {"type": "enum", "values": ["DDR1","DDR2","DDR3","DDR4","DDR5"]},
    "capacity_gb": {"type": "number"},
    "speed_mhz": {"type": "number"},
    "brand": {"type": "string"}
  }'::jsonb, ARRAY['marktplaats','tweakers']::platform_slug[], ARRAY[]::buyback_service_slug[]),

  ('cpu', 'Processor (CPU)', '{
    "brand": {"type": "enum", "values": ["Intel","AMD","Other"]},
    "model": {"type": "string"},
    "socket": {"type": "string"},
    "cores": {"type": "number"},
    "tdp_w": {"type": "number"}
  }'::jsonb, ARRAY['marktplaats','tweakers']::platform_slug[], ARRAY[]::buyback_service_slug[]),

  ('gpu', 'Videokaart (GPU)', '{
    "brand": {"type": "enum", "values": ["NVIDIA","AMD","Intel"]},
    "model": {"type": "string"},
    "vram_gb": {"type": "number"},
    "interface": {"type": "string"}
  }'::jsonb, ARRAY['marktplaats','tweakers','ebay']::platform_slug[], ARRAY[]::buyback_service_slug[]),

  ('console', 'Spelcomputer', '{
    "brand": {"type": "enum", "values": ["Microsoft","Sony","Nintendo","Sega","Other"]},
    "model": {"type": "string"},
    "region": {"type": "enum", "values": ["PAL","NTSC","NTSC-J"]},
    "includes_controller": {"type": "boolean"},
    "includes_cables": {"type": "boolean"},
    "storage_gb": {"type": "number"}
  }'::jsonb,
  ARRAY['marktplaats','ebay','catawiki']::platform_slug[],
  ARRAY['levelseven','nedgame','flashkaartshop']::buyback_service_slug[]),

  ('console_game', 'Spelletje', '{
    "platform": {"type": "string"},
    "title": {"type": "string"},
    "region": {"type": "string"},
    "includes_manual": {"type": "boolean"},
    "includes_box": {"type": "boolean"}
  }'::jsonb,
  ARRAY['marktplaats','ebay']::platform_slug[],
  ARRAY['levelseven','nedgame']::buyback_service_slug[]),

  ('smartphone', 'Smartphone', '{
    "brand": {"type": "string"},
    "model": {"type": "string"},
    "storage_gb": {"type": "number"},
    "color": {"type": "string"},
    "imei": {"type": "string"},
    "battery_health_pct": {"type": "number"}
  }'::jsonb, ARRAY['marktplaats','ebay']::platform_slug[], ARRAY[]::buyback_service_slug[]),

  ('laptop', 'Laptop', '{
    "brand": {"type": "string"},
    "model": {"type": "string"},
    "cpu": {"type": "string"},
    "ram_gb": {"type": "number"},
    "storage_gb": {"type": "number"},
    "screen_inch": {"type": "number"}
  }'::jsonb, ARRAY['marktplaats','tweakers','ebay']::platform_slug[], ARRAY[]::buyback_service_slug[]),

  ('pokemon_card', 'Pokémon Kaart', '{
    "card_name": {"type": "string"},
    "set_name": {"type": "string"},
    "set_number": {"type": "string"},
    "rarity": {"type": "enum", "values": ["common","uncommon","rare","holo_rare","ultra_rare","secret_rare","promo"]},
    "language": {"type": "enum", "values": ["NL","EN","DE","FR","JP","Other"]},
    "is_holo": {"type": "boolean"},
    "is_first_edition": {"type": "boolean"},
    "is_shadowless": {"type": "boolean"},
    "graded_by": {"type": "string"},
    "grade_score": {"type": "number"},
    "cardmarket_id": {"type": "string"},
    "tcg_api_id": {"type": "string"}
  }'::jsonb,
  ARRAY['cardmarket','ebay','marktplaats']::platform_slug[],
  ARRAY['rarecards','catchcollect']::buyback_service_slug[]),

  ('antique_tin', 'Antiek Tin / Tinnewerk', '{
    "period": {"type": "string"},
    "maker_mark": {"type": "string"},
    "maker_mark_identified": {"type": "string"},
    "region_of_origin": {"type": "string"},
    "material": {"type": "enum", "values": ["tin","pewter","britannia_metal","other"]},
    "item_type": {"type": "string"},
    "height_cm": {"type": "number"},
    "width_cm": {"type": "number"},
    "weight_g": {"type": "number"},
    "provenance": {"type": "string"}
  }'::jsonb,
  ARRAY['catawiki','marktplaats','ebay']::platform_slug[],
  ARRAY[]::buyback_service_slug[]),

  ('antique_silver', 'Antiek Zilver', '{
    "hallmarks": {"type": "array"},
    "silver_grade": {"type": "enum", "values": ["925","835","800","unknown"]},
    "period": {"type": "string"},
    "maker": {"type": "string"},
    "weight_g": {"type": "number"},
    "item_type": {"type": "string"},
    "provenance": {"type": "string"}
  }'::jsonb,
  ARRAY['catawiki','ebay','marktplaats']::platform_slug[],
  ARRAY[]::buyback_service_slug[]),

  ('antique_other', 'Antiek (overig)', '{}'::jsonb,
    ARRAY['catawiki','marktplaats','ebay']::platform_slug[],
    ARRAY[]::buyback_service_slug[]),

  ('electronics_other', 'Elektronica (overig)', '{}'::jsonb,
    ARRAY['marktplaats','tweakers','ebay']::platform_slug[],
    ARRAY[]::buyback_service_slug[]),

  ('unknown', 'Onbekend', '{}'::jsonb,
    ARRAY[]::platform_slug[],
    ARRAY[]::buyback_service_slug[]),

  ('other', 'Overig', '{}'::jsonb,
    ARRAY['marktplaats','ebay']::platform_slug[],
    ARRAY[]::buyback_service_slug[]);

-- ═══ Products (aangepast voor 2-fasen workflow) ═══════════════════
CREATE TABLE products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sticker-ID (v2)
  sticker_id            TEXT UNIQUE,
  sticker_input_method  sticker_input_method,
  sticker_confidence    DECIMAL,

  -- Fase A: Indexering
  category_slug         category_slug REFERENCES categories(slug) DEFAULT 'unknown',
  working_title         TEXT,
  indexing_notes        TEXT,

  -- Fase B: Verkoop (pas ingevuld bij analyse)
  title                 TEXT,
  description           TEXT,
  condition             product_condition,
  specs                 JSONB DEFAULT '{}',
  defects               TEXT[] DEFAULT '{}',
  included_accessories  TEXT[] DEFAULT '{}',
  missing_items         TEXT[] DEFAULT '{}',

  -- EAN / barcode
  ean                   TEXT,
  barcode_type          TEXT,
  identified_via        TEXT,

  -- Waardering
  estimated_value_min   DECIMAL,
  estimated_value_max   DECIMAL,
  recommended_price     DECIMAL,
  new_price             DECIMAL,
  new_price_source_url  TEXT,

  -- Status
  status                product_status DEFAULT 'indexed',

  -- Verkoop
  selling_tier          TEXT CHECK (selling_tier IN ('individual','bundle','bulk')),
  sold_price            DECIMAL,
  sold_platform_id      UUID REFERENCES platforms(id),
  sold_at               TIMESTAMPTZ,

  -- Antiek-specifiek
  provenance_notes      TEXT,

  -- Tijdstempels
  indexed_at            TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_products_sticker ON products(sticker_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category_slug);
CREATE INDEX idx_products_ean ON products(ean) WHERE ean IS NOT NULL;
CREATE INDEX idx_products_indexed_at ON products(indexed_at DESC);

-- ═══ Photos (aangepast voor sticker detectie) ═════════════════════
CREATE TABLE photos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  storage_path      TEXT NOT NULL,
  thumbnail_path    TEXT,
  order_index       INTEGER DEFAULT 0,
  photo_type        photo_type DEFAULT 'general',
  capture_mode      TEXT,

  -- Sticker detectie
  sticker_visible   BOOLEAN DEFAULT false,
  detected_sticker  TEXT,
  ocr_confidence    DECIMAL,

  -- Image meta
  width             INTEGER,
  height            INTEGER,
  size_bytes        INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photos_product ON photos(product_id);
CREATE INDEX idx_photos_order ON photos(product_id, order_index);
CREATE INDEX idx_photos_type ON photos(photo_type);

-- ═══ Buyback quotes ═══════════════════════════════════════════════
CREATE TABLE buyback_quotes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  buyback_service_id    UUID REFERENCES buyback_services(id) NOT NULL,
  quoted_price          DECIMAL,
  quote_source          TEXT,
  quote_url             TEXT,
  conditions            TEXT,
  valid_until           TIMESTAMPTZ,
  fetched_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, buyback_service_id)
);

CREATE INDEX idx_buyback_quotes_product ON buyback_quotes(product_id);

-- ═══ Listings ═════════════════════════════════════════════════════
CREATE TABLE listings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  platform_id           UUID REFERENCES platforms(id) NOT NULL,
  status                listing_status DEFAULT 'draft',
  price                 DECIMAL NOT NULL,
  shipping_price        DECIMAL DEFAULT 0,
  generated_title       TEXT,
  generated_description TEXT,
  final_title           TEXT,
  final_description     TEXT,
  platform_category_id  TEXT,
  platform_attrs        JSONB DEFAULT '{}',
  external_id           TEXT,
  listing_url           TEXT,
  approved_at           TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  sold_at               TIMESTAMPTZ,
  error_message         TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, platform_id)
);

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_listings_product ON listings(product_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_platform ON listings(platform_id);

-- ═══ Price history ════════════════════════════════════════════════
CREATE TABLE price_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID REFERENCES products(id) ON DELETE CASCADE,
  platform_id    UUID REFERENCES platforms(id),
  search_query   TEXT,
  price_low      DECIMAL,
  price_avg      DECIMAL,
  price_high     DECIMAL,
  price_trend    DECIMAL,
  sample_count   INTEGER,
  currency       TEXT DEFAULT 'EUR',
  source_url     TEXT,
  fetched_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_history_product ON price_history(product_id, fetched_at DESC);

-- ═══ Bundles (uitgebreid voor Claude MCP reasoning) ═══════════════
CREATE TABLE bundles (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  TEXT NOT NULL,
  description            TEXT,
  bundle_type            bundle_type DEFAULT 'custom',
  suggested_by           TEXT DEFAULT 'user',
  claude_reasoning       TEXT,
  total_individual_value DECIMAL,
  suggested_price        DECIMAL,
  status                 product_status DEFAULT 'ready_to_list',
  notes                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER bundles_updated_at
  BEFORE UPDATE ON bundles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE bundle_items (
  bundle_id   UUID REFERENCES bundles(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  position    INTEGER DEFAULT 0,
  PRIMARY KEY (bundle_id, product_id)
);

-- ═══ Claude analyses log (vervangt ai_analyses uit v1) ════════════
CREATE TABLE claude_analyses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_type    TEXT,
  subject_products UUID[],
  claude_source    TEXT,
  user_prompt      TEXT,
  claude_response  JSONB,
  applied          BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ Price watches ════════════════════════════════════════════════
CREATE TABLE price_watches (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT,
  search_query         TEXT NOT NULL,
  platform_id          UUID REFERENCES platforms(id),
  category_slug        category_slug,
  target_price         DECIMAL,
  current_lowest       DECIMAL,
  alert_on_below       DECIMAL,
  last_checked_at      TIMESTAMPTZ,
  check_interval_hours INTEGER DEFAULT 6,
  is_active            BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ Taxatie exports ══════════════════════════════════════════════
CREATE TABLE taxatie_exports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID REFERENCES products(id),
  bundle_id        UUID REFERENCES bundles(id),
  pdf_storage_path TEXT,
  recipient_name   TEXT,
  recipient_email  TEXT,
  exported_at      TIMESTAMPTZ DEFAULT NOW(),
  CHECK (product_id IS NOT NULL OR bundle_id IS NOT NULL)
);

-- ═══ App settings ═════════════════════════════════════════════════
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES
  ('default_location', '"Oss, Nederland"'::jsonb),
  ('default_shipping', '{"postnl": true, "dhl": true, "pickup": true}'::jsonb),
  ('platforms_enabled', '["marktplaats","tweakers","cardmarket","ebay"]'::jsonb),
  ('ai_model', '"claude-sonnet-4-6"'::jsonb),
  ('language', '"nl"'::jsonb),
  ('seller_name', '""'::jsonb),
  ('whatsapp_number', '""'::jsonb),
  ('cardmarket_credentials', '{}'::jsonb),
  ('marktplaats_credentials', '{}'::jsonb),
  ('ebay_credentials', '{}'::jsonb),
  ('last_sticker_number', '0'::jsonb),
  ('default_sticker_mode', '"ocr_separate"'::jsonb),
  ('quick_replies', '[
    "Ja, dit is nog beschikbaar!",
    "De prijs is helaas vast.",
    "Ik verstuur via PostNL, kosten zijn €4,25.",
    "Ophalen kan in Oss, afspraak maken via WhatsApp."
  ]'::jsonb);

-- ═══ Row Level Security ═══════════════════════════════════════════

-- User data tables: authenticated-only full access
ALTER TABLE sticker_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyback_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claude_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxatie_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_access_sticker_sheets" ON sticker_sheets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access_products" ON products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access_photos" ON photos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access_buyback_quotes" ON buyback_quotes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access_listings" ON listings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access_price_history" ON price_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access_bundles" ON bundles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access_bundle_items" ON bundle_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access_claude_analyses" ON claude_analyses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access_price_watches" ON price_watches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access_taxatie_exports" ON taxatie_exports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access_app_settings" ON app_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Reference tables: public read (inloggen niet nodig voor platform/category lijsten)
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyback_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_platforms" ON platforms FOR SELECT USING (true);
CREATE POLICY "read_categories" ON categories FOR SELECT USING (true);
CREATE POLICY "read_buyback_services" ON buyback_services FOR SELECT USING (true);
