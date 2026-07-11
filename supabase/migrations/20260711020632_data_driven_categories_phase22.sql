-- Phase 22: categorieën als data i.p.v. Postgres enum
-- Nieuwe categorieën toevoegen = een rij in categories, geen migration meer.
-- (Volledige SQL zoals toegepast op het live project.)

-- 1. Drop FKs die over het enum-type lopen
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_slug_fkey;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_parent_slug_fkey;

-- 2. Converteer kolommen enum → TEXT
ALTER TABLE categories ALTER COLUMN slug TYPE TEXT USING slug::text;
ALTER TABLE categories ALTER COLUMN parent_slug TYPE TEXT USING parent_slug::text;
ALTER TABLE products ALTER COLUMN category_slug DROP DEFAULT;
ALTER TABLE products ALTER COLUMN category_slug TYPE TEXT USING category_slug::text;
ALTER TABLE products ALTER COLUMN category_slug SET DEFAULT 'unknown';
ALTER TABLE price_watches ALTER COLUMN category_slug TYPE TEXT USING category_slug::text;

-- 3. FKs terugzetten
ALTER TABLE categories ADD CONSTRAINT categories_parent_slug_fkey
  FOREIGN KEY (parent_slug) REFERENCES categories(slug);
ALTER TABLE products ADD CONSTRAINT products_category_slug_fkey
  FOREIGN KEY (category_slug) REFERENCES categories(slug);

-- 4. Slug-vorm afdwingen (lowercase snake_case)
ALTER TABLE categories ADD CONSTRAINT categories_slug_format
  CHECK (slug ~ '^[a-z0-9_]+$');

-- 5. Nieuwe categorieën (kleding bestond al sinds fase 15)
INSERT INTO categories (slug, name, spec_schema, preferred_platforms, preferred_buyback_services) VALUES
  ('handbags', 'Tassen', '{"brand":{"type":"string"},"model":{"type":"string"},"material":{"type":"string"},"color":{"type":"string"},"authenticity":{"type":"string"},"dustbag_included":{"type":"boolean"}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('shoes', 'Schoenen', '{"brand":{"type":"string"},"size_eu":{"type":"string"},"color":{"type":"string"},"gender":{"type":"enum","values":["men","women","unisex","kids"]}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('accessories', 'Accessoires', '{"brand":{"type":"string"},"type":{"type":"string"},"material":{"type":"string"}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('jewelry', 'Sieraden', '{"material":{"type":"string"},"gemstone":{"type":"string"},"hallmark":{"type":"string"},"weight_grams":{"type":"number"}}'::jsonb, ARRAY['marktplaats','catawiki']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('watches', 'Horloges', '{"brand":{"type":"string"},"model":{"type":"string"},"movement":{"type":"string"},"box_papers":{"type":"boolean"}}'::jsonb, ARRAY['marktplaats','catawiki']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('books', 'Boeken', '{"author":{"type":"string"},"isbn":{"type":"string"},"language":{"type":"string"},"year":{"type":"number"}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('toys', 'Speelgoed', '{"brand":{"type":"string"},"age_range":{"type":"string"},"complete":{"type":"boolean"}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('board_games', 'Bordspellen', '{"publisher":{"type":"string"},"complete":{"type":"boolean"},"language":{"type":"string"}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('vinyl_music', 'Vinyl & Muziek', '{"artist":{"type":"string"},"format":{"type":"string"},"pressing":{"type":"string"},"condition_media":{"type":"string"}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('kitchenware', 'Keukengerei', '{"brand":{"type":"string"},"type":{"type":"string"}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('tools', 'Gereedschap', '{"brand":{"type":"string"},"type":{"type":"string"},"powered":{"type":"boolean"}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('sports', 'Sport & Outdoor', '{"brand":{"type":"string"},"type":{"type":"string"},"size":{"type":"string"}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('bicycles', 'Fietsen', '{"brand":{"type":"string"},"type":{"type":"string"},"frame_size":{"type":"string"},"wheel_size":{"type":"string"}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('furniture', 'Meubels', '{"type":{"type":"string"},"material":{"type":"string"},"dimensions":{"type":"string"}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('home_decor', 'Woondecoratie', '{"type":{"type":"string"},"material":{"type":"string"}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[]),
  ('garden', 'Tuin', '{"type":{"type":"string"},"brand":{"type":"string"}}'::jsonb, ARRAY['marktplaats','2dehands']::platform_slug[], ARRAY[]::buyback_service_slug[])
ON CONFLICT (slug) DO NOTHING;
