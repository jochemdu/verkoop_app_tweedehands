-- Phase 15: voeg clothing toe aan category_slug enum
-- (PostgreSQL vereist hiervoor ALTER TYPE ADD VALUE, niet alterbaar binnen
-- transactions voor direct gebruik maar dat is prima buiten migration).
ALTER TYPE category_slug ADD VALUE IF NOT EXISTS 'clothing';

-- Insert de seed rij voor de nieuwe categorie (in aparte statement zodat de
-- nieuwe enum value beschikbaar is).
COMMIT;
BEGIN;

INSERT INTO categories (slug, name, spec_schema, preferred_platforms, preferred_buyback_services)
VALUES (
  'clothing'::category_slug,
  'Kleding',
  '{"brand":{"type":"string"},"size":{"type":"string"},"color":{"type":"string"},"material":{"type":"string"},"gender":{"type":"enum","values":["men","women","unisex","kids"]},"item_type":{"type":"string"}}'::jsonb,
  ARRAY['marktplaats','2dehands']::platform_slug[],
  ARRAY[]::buyback_service_slug[]
)
ON CONFLICT (slug) DO NOTHING;
