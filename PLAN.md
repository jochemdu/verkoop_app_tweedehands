# VerkoopAssistent — Volledig Technisch Plan
*Persoonlijke AI-verkoopassistent voor tweedehands spullen — NL markt*
*Geoptimaliseerd voor gebruik met Claude Code*

---

## Snelle Start voor Claude Code

Dit document is het complete referentieplan. Gebruik het als volgt:

```
# 1. Plaats dit bestand als PLAN.md in de root van je project
# 2. Start Claude Code in de projectmap
# 3. Vraag Claude Code:
#    "Lees PLAN.md en implementeer Fase 1 (Foundation)"
#
# Of voor specifieke stappen:
#    "Lees PLAN.md sectie 3 en rol het database-schema uit via de Supabase MCP"
#    "Lees PLAN.md sectie 9 en maak de Expo app structuur aan"
```

**Werkwijze:** Het plan is opgedeeld in fases met concrete taken. Elke grote sectie heeft een `## ✅ Claude Code Taken` blok met kopieerbare prompts. MCP-servers (Supabase, Vercel) zijn actief — Claude Code kan direct tabellen aanmaken en deployen.

---

## 1. Architectuuroverzicht

```
┌─────────────────────────────────────────────────────────────────┐
│                    JOUW DEVICES                                  │
│                                                                  │
│  📱 Expo App (iOS/Android)      💻 Next.js Web (Vercel)         │
│  • Camera & foto's maken        • Bulk foto upload              │
│  • Barcode/EAN scanner          • Dashboard & statistieken      │
│  • Snel scannen onderweg        • Bulk advertenties bewerken    │
│  • Merkteken macro-modus        • Database beheer               │
│  • Notificaties                 • PDF export (taxatie)          │
│  • Listings goedkeuren                                          │
└──────────────┬──────────────────────────┬───────────────────────┘
               │                          │
               └──────────┬───────────────┘
                          │
         ┌────────────────▼────────────────────┐
         │           SUPABASE                  │
         │                                     │
         │  🗄️  PostgreSQL Database            │
         │  🔐  Auth (magic link / email)      │
         │  📁  Storage (foto's)               │
         │  ⚡  Edge Functions (AI-proxy)      │
         │  ⏰  pg_cron (prijswatchers)        │
         │  🔴  Realtime (sync app ↔ web)     │
         └──────────────┬──────────────────────┘
                        │
         ┌──────────────┼──────────────────────┐
         │              │                      │
    ┌────▼────┐   ┌─────▼─────┐   ┌───────────▼──────┐
    │ Claude  │   │Cardmarket │   │  Marktplaats API  │
    │ Vision  │   │  API v2   │   │  Tweakers scraper │
    │ Sonnet  │   │  (kaarten)│   │  eBay API         │
    └─────────┘   └───────────┘   │  Opkoopdiensten   │
                                  └──────────────────┘
```

### Waarom deze keuze
- **Supabase voor alles**: één platform voor database, auth, storage en serverside logica
- **Next.js op Vercel voor web**: beste PC-ervaring, native Vercel+Supabase integratie
- **Expo voor mobiel**: gedeelde React-kennis met de web-app, beste camera-integratie
- **Supabase Edge Functions** als AI-proxy: API-keys blijven server-side, caching mogelijk
- **pg_cron** voor prijswatchers: draait onafhankelijk van jouw telefoon/pc

---

## 2. Volledige Tech Stack

### Mobiele App (Expo)
| Pakket | Gebruik |
|--------|---------|
| `expo` SDK 55 | Framework |
| `expo-router` v7 | File-based navigatie |
| `expo-camera` | Camera + foto's maken |
| `expo-barcode-scanner` | **EAN barcode scannen** (nieuw) |
| `expo-image-picker` | Galerij multi-select |
| `expo-image-manipulator` | Resize voor upload |
| `expo-image` | Geoptimaliseerde weergave |
| `expo-notifications` | Push notificaties |
| `expo-file-system` | Lokale opslag |
| `@supabase/supabase-js` v2 | Database + Auth + Storage |
| `react-native-mmkv` | Snelle lokale opslag |
| `zustand` v4 | State management |
| `@tanstack/react-query` v5 | Server state + caching |

### Web App (Next.js op Vercel)
| Pakket | Gebruik |
|--------|---------|
| `next` v14+ (App Router) | Framework |
| `@supabase/supabase-js` + `@supabase/ssr` | Database + Auth |
| `tailwindcss` v4 + `shadcn/ui` | Styling & componenten |
| `recharts` | Grafieken & statistieken |
| `@tanstack/react-table` | Bulk-tabel met sorteren/filteren |
| `react-dropzone` | Drag & drop foto upload |
| `react-hook-form` + `zod` | Formuliervalidatie |
| `@react-pdf/renderer` | **PDF export voor taxatie** (nieuw) |

### Backend (Supabase Edge Functions — Deno/TypeScript)
| Functie | Beschrijving |
|---------|-------------|
| `analyze-product` | Claude Vision aanroepen, resultaat opslaan |
| `lookup-ean` | **EAN/barcode → Tweakers prijs + productinfo** (nieuw) |
| `generate-listing` | Advertentietekst genereren per platform |
| `fetch-prices` | Marktplaats/Tweakers/Cardmarket/eBay prijzen |
| `fetch-buyback-quotes` | **Opkoopdiensten-prijzen ophalen** (nieuw) |
| `identify-card` | Pokémon-kaart herkennen |
| `identify-antique` | Antiek + merkteken opzoeken |
| `publish-listing` | Advertentie publiceren via platform-API |
| `generate-taxatie-pdf` | **PDF-dossier voor taxateur** (nieuw) |
| `price-watcher-cron` | Elke 6 uur prijzen bijwerken (pg_cron) |
| `push-notifier` | Push notificaties via Expo |

---

## 3. Database Schema (Supabase PostgreSQL)

### Extensies
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";
```

### Enum types
```sql
CREATE TYPE product_condition AS ENUM (
  'mint', 'near_mint', 'excellent', 'very_good', 'good', 'fair', 'poor'
);

CREATE TYPE product_status AS ENUM (
  'draft', 'analyzing', 'pending_review', 'approved',
  'listed', 'sold', 'archived'
);

CREATE TYPE listing_status AS ENUM (
  'draft', 'pending_review', 'approved',
  'publishing', 'published', 'sold', 'expired', 'error'
);

CREATE TYPE photo_type AS ENUM (
  'general', 'front', 'back', 'mark', 'detail',
  'damage', 'serial', 'label', 'holo', 'barcode'
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
  'antique_other', 'electronics_other', 'other'
);

CREATE TYPE bundle_type AS ENUM (
  'ram_kit', 'console_bundle', 'card_lot',
  'card_set', 'hardware_bundle', 'custom'
);
```

### Platforms
```sql
CREATE TABLE platforms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              platform_slug UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  base_url          TEXT,
  commission_rate   DECIMAL DEFAULT 0,
  fixed_fee         DECIMAL DEFAULT 0,
  api_available     BOOLEAN DEFAULT false,
  api_type          TEXT,
  supports_bulk     BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true
);

INSERT INTO platforms (slug, name, base_url, commission_rate, api_available, api_type) VALUES
  ('marktplaats', 'Marktplaats.nl', 'https://marktplaats.nl', 0, true, 'rest'),
  ('tweakers', 'Tweakers V&A', 'https://tweakers.net/aanbod', 0, false, 'scraping'),
  ('cardmarket', 'Cardmarket', 'https://cardmarket.com', 0.05, true, 'rest'),
  ('ebay', 'eBay', 'https://ebay.nl', 0.1153, true, 'rest'),
  ('catawiki', 'Catawiki', 'https://catawiki.nl', 0.125, false, 'manual'),
  ('2dehands', '2dehands.be', 'https://2dehands.be', 0, true, 'rest'),
  ('facebook', 'Facebook Marketplace', 'https://facebook.com/marketplace', 0, false, 'manual');
```

### Opkoopdiensten (nieuw)
```sql
CREATE TABLE buyback_services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              buyback_service_slug UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  website_url       TEXT,
  specialization    TEXT,
  api_available     BOOLEAN DEFAULT false,
  typical_discount  DECIMAL,
  is_active         BOOLEAN DEFAULT true,
  notes             TEXT
);

INSERT INTO buyback_services (slug, name, website_url, specialization, typical_discount) VALUES
  ('levelseven', 'Level Seven', 'https://levelseven.nl', 'retro_games', 0.55),
  ('nedgame', 'Nedgame', 'https://nedgame.nl/online-inruilen', 'retro_games', 0.50),
  ('flashkaartshop', 'Flashkaartshop', 'https://flashkaartshop.nl', 'retro_games', 0.60),
  ('rarecards', 'RareCards', 'https://rarecards.nl', 'pokemon_cards', 0.60),
  ('catchcollect', 'CatchCollect', 'https://catchcollect.nl', 'pokemon_cards', 0.55);
```

### Categorieën met spec-schemas
```sql
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        category_slug UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  parent_slug category_slug REFERENCES categories(slug),
  spec_schema JSONB DEFAULT '{}',
  preferred_platforms platform_slug[] DEFAULT '{}',
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
  }', ARRAY['marktplaats','tweakers']::platform_slug[],
     ARRAY[]::buyback_service_slug[]),

  ('ram_sodimm', 'RAM SODIMM (laptop)', '{
    "generation": {"type": "enum", "values": ["DDR1","DDR2","DDR3","DDR4","DDR5"]},
    "capacity_gb": {"type": "number"},
    "speed_mhz": {"type": "number"},
    "brand": {"type": "string"}
  }', ARRAY['marktplaats','tweakers']::platform_slug[],
     ARRAY[]::buyback_service_slug[]),

  ('cpu', 'Processor (CPU)', '{
    "brand": {"type": "enum", "values": ["Intel","AMD","Other"]},
    "model": {"type": "string"},
    "socket": {"type": "string"},
    "cores": {"type": "number"},
    "tdp_w": {"type": "number"}
  }', ARRAY['marktplaats','tweakers']::platform_slug[],
     ARRAY[]::buyback_service_slug[]),

  ('gpu', 'Videokaart (GPU)', '{
    "brand": {"type": "enum", "values": ["NVIDIA","AMD","Intel"]},
    "model": {"type": "string"},
    "vram_gb": {"type": "number"},
    "interface": {"type": "string"}
  }', ARRAY['marktplaats','tweakers','ebay']::platform_slug[],
     ARRAY[]::buyback_service_slug[]),

  ('console', 'Spelcomputer', '{
    "brand": {"type": "enum", "values": ["Microsoft","Sony","Nintendo","Sega","Other"]},
    "model": {"type": "string"},
    "region": {"type": "enum", "values": ["PAL","NTSC","NTSC-J"]},
    "includes_controller": {"type": "boolean"},
    "includes_cables": {"type": "boolean"},
    "storage_gb": {"type": "number"}
  }', ARRAY['marktplaats','ebay','catawiki']::platform_slug[],
     ARRAY['levelseven','nedgame','flashkaartshop']::buyback_service_slug[]),

  ('console_game', 'Spelletje', '{
    "platform": {"type": "string"},
    "title": {"type": "string"},
    "region": {"type": "string"},
    "includes_manual": {"type": "boolean"},
    "includes_box": {"type": "boolean"}
  }', ARRAY['marktplaats','ebay']::platform_slug[],
     ARRAY['levelseven','nedgame']::buyback_service_slug[]),

  ('smartphone', 'Smartphone', '{
    "brand": {"type": "string"},
    "model": {"type": "string"},
    "storage_gb": {"type": "number"},
    "color": {"type": "string"},
    "imei": {"type": "string"},
    "battery_health_pct": {"type": "number"}
  }', ARRAY['marktplaats','ebay']::platform_slug[],
     ARRAY[]::buyback_service_slug[]),

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
  }', ARRAY['cardmarket','ebay','marktplaats']::platform_slug[],
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
  }', ARRAY['catawiki','marktplaats','ebay']::platform_slug[],
     ARRAY[]::buyback_service_slug[]),

  ('antique_silver', 'Antiek Zilver', '{
    "hallmarks": {"type": "array"},
    "silver_grade": {"type": "enum", "values": ["925","835","800","unknown"]},
    "period": {"type": "string"},
    "maker": {"type": "string"},
    "weight_g": {"type": "number"},
    "item_type": {"type": "string"},
    "provenance": {"type": "string"}
  }', ARRAY['catawiki','ebay','marktplaats']::platform_slug[],
     ARRAY[]::buyback_service_slug[]);
```

### Producten (kern) — inclusief EAN, gebreken en accessoires
```sql
CREATE TABLE products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug         category_slug REFERENCES categories(slug),
  title                 TEXT,
  description           TEXT,
  condition             product_condition,
  status                product_status DEFAULT 'draft',

  -- EAN/barcode (nieuw)
  ean                   TEXT,
  barcode_type          TEXT,
  identified_via        TEXT,           -- 'barcode', 'ai_vision', 'manual'

  -- AI-analyse resultaten
  ai_title              TEXT,
  ai_description        TEXT,
  ai_condition          product_condition,
  ai_confidence         DECIMAL,
  ai_category_detected  TEXT,
  specs                 JSONB DEFAULT '{}',

  -- Gebreken en accessoires (nieuw)
  defects               TEXT[] DEFAULT '{}',
  included_accessories  TEXT[] DEFAULT '{}',
  missing_items         TEXT[] DEFAULT '{}',

  -- Waardering
  estimated_value_min   DECIMAL,
  estimated_value_max   DECIMAL,
  recommended_price     DECIMAL,
  new_price             DECIMAL,
  new_price_source_url  TEXT,

  -- Verkoop
  selling_tier          TEXT CHECK (selling_tier IN ('individual','bundle','bulk')),
  sold_price            DECIMAL,
  sold_platform_id      UUID REFERENCES platforms(id),
  sold_at               TIMESTAMPTZ,

  -- Meta
  notes                 TEXT,
  provenance_notes      TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category_slug);
CREATE INDEX idx_products_ean ON products(ean) WHERE ean IS NOT NULL;
```

### Foto's met capture-mode
```sql
CREATE TABLE photos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  storage_path   TEXT NOT NULL,
  thumbnail_path TEXT,
  order_index    INTEGER DEFAULT 0,
  photo_type     photo_type DEFAULT 'general',
  capture_mode   TEXT,            -- 'normal', 'macro_mark', 'detail_damage', 'barcode'
  width          INTEGER,
  height         INTEGER,
  size_bytes     INTEGER,
  ai_labels      JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photos_product ON photos(product_id);
CREATE INDEX idx_photos_order ON photos(product_id, order_index);
CREATE INDEX idx_photos_type ON photos(photo_type);
```

### Opkoop-offertes (nieuw)
```sql
CREATE TABLE buyback_quotes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  buyback_service_id    UUID REFERENCES buyback_services(id) NOT NULL,
  quoted_price          DECIMAL,
  quote_source          TEXT,         -- 'manual', 'api', 'scraped'
  quote_url             TEXT,
  conditions            TEXT,
  valid_until           TIMESTAMPTZ,
  fetched_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, buyback_service_id)
);

CREATE INDEX idx_buyback_quotes_product ON buyback_quotes(product_id);
```

### Listings
```sql
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
```

### Overige tabellen
```sql
-- Prijsgeschiedenis
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

-- Bundles
CREATE TABLE bundles (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  TEXT NOT NULL,
  bundle_type            bundle_type DEFAULT 'custom',
  suggested_by           TEXT DEFAULT 'user',
  total_individual_value DECIMAL,
  suggested_price        DECIMAL,
  status                 product_status DEFAULT 'draft',
  notes                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bundle_items (
  bundle_id  UUID REFERENCES bundles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  position   INTEGER DEFAULT 0,
  PRIMARY KEY (bundle_id, product_id)
);

-- AI analyses log
CREATE TABLE ai_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  analysis_type   TEXT,
  model_used      TEXT,
  input_photo_ids UUID[],
  prompt_hash     TEXT,
  raw_response    JSONB,
  parsed_result   JSONB,
  confidence      DECIMAL,
  tokens_input    INTEGER,
  tokens_output   INTEGER,
  cost_usd        DECIMAL,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ai_analyses_product ON ai_analyses(product_id);

-- Prijswatchers
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

-- Taxatie dossiers (nieuw)
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

-- App instellingen
CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES
  ('default_location', '"Oss, Nederland"'),
  ('default_shipping', '{"postnl": true, "dhl": true, "pickup": true}'),
  ('platforms_enabled', '["marktplaats","tweakers","cardmarket","ebay"]'),
  ('ai_model', '"claude-sonnet-4-6"'),
  ('language', '"nl"'),
  ('seller_name', '""'),
  ('whatsapp_number', '""'),
  ('cardmarket_credentials', '{}'),
  ('marktplaats_credentials', '{}'),
  ('ebay_credentials', '{}'),
  ('quick_replies', '[
    "Ja, dit is nog beschikbaar!",
    "De prijs is helaas vast.",
    "Ik verstuur via PostNL, kosten zijn €4,25.",
    "Ophalen kan in Oss, afspraak maken via WhatsApp."
  ]');
```

### Row Level Security (solo gebruiker)
```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyback_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxatie_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Alleen authenticated users hebben toegang
CREATE POLICY "auth_full_access_products" ON products
  FOR ALL USING (auth.role() = 'authenticated');
-- Herhaal dit voor elke tabel...

-- Publieke referentie-tabellen
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyback_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_platforms" ON platforms FOR SELECT USING (true);
CREATE POLICY "read_categories" ON categories FOR SELECT USING (true);
CREATE POLICY "read_buyback_services" ON buyback_services FOR SELECT USING (true);
```

### ✅ Claude Code Taken — Sectie 3

```
Taak 3.1: Maak een Supabase project aan via de Supabase MCP.
Taak 3.2: Rol het volledige schema uit (extensies → enums → platforms →
          buyback_services → categories → products → photos → listings →
          overige tabellen → RLS policies).
Taak 3.3: Verifieer met SELECT * FROM platforms dat alle 7 platforms erin staan.
Taak 3.4: Maak Storage buckets aan: 'product-photos' (private),
          'bulk-uploads' (private) en 'taxatie-pdfs' (private).
```

---

## 4. Supabase Storage Structuur

```
product-photos/           (private bucket)
└── {product_id}/
    ├── original/
    │   ├── {photo_id}.jpg
    │   └── ...
    └── thumbnails/       (auto via Storage transforms)

bulk-uploads/             (tijdelijke, cleanup na 7 dagen)
└── {timestamp}_{filename}.jpg

taxatie-pdfs/             (voor taxatie dossiers)
└── {product_id}_{timestamp}.pdf
```

---

## 5. Projectstructuur

```
verkoopassistent/
├── PLAN.md                        ← dit document
├── .env.example
├── supabase/
│   ├── migrations/
│   │   └── 0001_initial_schema.sql
│   ├── functions/
│   │   ├── analyze-product/
│   │   ├── lookup-ean/
│   │   ├── generate-listing/
│   │   ├── fetch-prices/
│   │   ├── fetch-buyback-quotes/
│   │   ├── identify-card/
│   │   ├── identify-antique/
│   │   ├── publish-listing/
│   │   ├── generate-taxatie-pdf/
│   │   ├── price-watcher-cron/
│   │   └── push-notifier/
│   └── config.toml
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types.ts
│       │   ├── schemas.ts
│       │   └── index.ts
│       └── package.json
├── apps/
│   ├── web/                       ← Next.js (Vercel)
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── package.json
│   └── mobile/                    ← Expo
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── package.json
└── package.json                   ← pnpm workspace root
```

---

## 6. Supabase Edge Functions

### `analyze-product` — Claude Vision
```typescript
// Input:  { productId, photoIds[], analysisType }
// Output: { category, title, condition, specs, defects,
//           accessories, confidence }
// Kosten: ~$0,033 per call (Claude Sonnet, 4 foto's)
```

### `lookup-ean` (nieuw) — EAN → Tweakers
```typescript
// Input: { ean, barcodeType }
// Flow:
//   1. Check cache in price_history
//   2. Tweakers Pricewatch scraper: tweakers.net/pricewatch/zoeken?keyword={ean}
//   3. Parse lowest price + product name + URL
//   4. Update products.new_price + new_price_source_url
// Output: { productName, newPrice, sourceUrl, tweakersId? }
```

### `fetch-buyback-quotes` (nieuw) — Opkoopprijzen
```typescript
// Input: { productId, serviceSlug? }
// Flow:
//   - levelseven.nl: scrape inkooppagina
//   - nedgame.nl: publieke inruillijst
//   - rarecards.nl / catchcollect.nl: voor pokémon bulk
// Output: Array<{ service, price, conditions, validUntil }>
// Schrijft naar buyback_quotes tabel
```

### `generate-taxatie-pdf` (nieuw) — PDF voor taxateur
```typescript
// Input: { productId | bundleId, recipientName?, recipientEmail? }
// Flow:
//   1. Haal product + foto's + merkteken-data op
//   2. Genereer PDF met @react-pdf/renderer
//   3. Bevat: voor/achter foto's, merkteken macro-foto's, specs,
//      provenance_notes, geschatte waarde, jouw contactgegevens
//   4. Upload naar taxatie-pdfs bucket
//   5. Log in taxatie_exports
// Output: { pdfUrl, downloadUrl (signed, 7 dagen geldig) }
```

### `price-watcher-cron` — pg_cron scheduled
```sql
SELECT cron.schedule('price-watcher', '0 */6 * * *',
  $$SELECT net.http_post(
    url := 'https://{ref}.functions.supabase.co/price-watcher-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_key')
    ),
    body := '{}'::jsonb
  )$$
);
```

### ✅ Claude Code Taken — Sectie 6

```
Taak 6.1: Maak supabase/functions/ map met alle 11 functies (stubs + README).
Taak 6.2: Implementeer lookup-ean eerst (kleinste, geen AI).
Taak 6.3: Implementeer analyze-product met Claude Sonnet Vision.
Taak 6.4: Implementeer generate-listing (Claude tekstgeneratie).
Taak 6.5: Zet prijswatcher cron op via Supabase MCP.
```

---

## 7. AI-Pipeline: Foto naar Advertentie

### Stap 1 — Input bepalen
```
Mobiel:
  • Barcode gedetecteerd? → lookup-ean → skip AI identificatie
  • Geen barcode → Camera sessie → Claude Vision

Web (PC):
  • Drag & drop foto's → optioneel EAN invullen
  • Auto-grouping op tijdstempel (<30s = zelfde product)
  • Batch-analyse knop
```

### Stap 2 — Productherkenning

**Met EAN (sneller, goedkoper):**
```
EAN → lookup-ean → Tweakers product match → category auto-detected →
Claude Vision alleen voor: conditie + gebreken + accessoires
```

**Zonder EAN (Claude Vision volledig):**
```
Foto's → analyze-product → Claude Sonnet Vision met prompt:

"Analyseer deze foto's van een te verkopen item. Retourneer JSON met:
- category: één van [ram_dimm, ram_sodimm, cpu, gpu, console, ...]
- title: Nederlandse producttitel
- condition: mint/near_mint/excellent/very_good/good/fair/poor
- confidence: 0.0-1.0
- specs: {categorie-specifieke velden}
- defects: [zichtbare gebreken]
- included_accessories: [zichtbare meegeleverde items]
- missing_items: [wat ontbreekt]
- selling_points: [verkoopargumenten]"
```

### Stap 3 — Categorie-specifieke logica

**RAM:** detecteer generatie, capaciteit, snelheid → check meerdere identieke sticks → suggereer KIT-bundle.

**Pokémon-kaart:**
```
1. GiblTCG API (gratis) → card_id + set + nummer
2. Pokémon TCG API → Cardmarket EUR prijs
3. Holo-detectie (meerdere hoeken)
4. Grading aanbeveling: IF rawValue > €50 AND condition >= near_mint
```

**Antiek tin/zilver:**
```
1. Claude Vision: algemene ID + periode-schatting
2. Gebruiker maakt merkteken-foto in "Merkteken (macro)" modus
3. identify-antique Edge Function:
   • Claude leest merkteken transcriptie
   • Nederlandse TinVereniging database lookup
   • Zilver.nl keurmerken database lookup
4. Handmatige validatie vóór publicatie
```

### Stap 4 — Prijsvergelijking
```
Hardware met EAN:    nieuw = Tweakers Pricewatch
                     tweedehands = Marktplaats + Tweakers V&A
Hardware zonder EAN: Claude schatting + Marktplaats zoekopdracht
Kaarten:             Cardmarket API (EUR)
Antiek:              Catawiki afgeronde veilingen
Consoles:            eBay sold listings + Marktplaats + opkoopdiensten
```

### Stap 5 — Advertentietekst per platform
```
Marktplaats (NL, 200-400 woorden):
  Opening → specs bulletpoints → staat + gebreken →
  accessoires → bezorging → contact

Tweakers V&A (NL, technisch):
  Specs eerst → staat in 1-2 zinnen → reden verkoop

Cardmarket (EN):
  Card name + set + number → language + condition → shipping

eBay (EN, keywords voor SEO):
  Titel met merk + model → bulletpoints → condition notes
```

### Stap 6 — Review & Publicatie
```
Review scherm toont:
  ✓ Foto's (reorderbaar, verwijderbaar)
  ✓ Herkende specs (bewerkbaar)
  ✓ Gebreken + accessoires (bewerkbaar)
  ✓ Gegenereerde tekst per platform (bewerkbaar)
  ✓ Prijs per platform (met commissie-berekening)
  ✓ Bundel-suggestie indien toepasselijk
  ✓ Opkoopdienst-prijzen ter vergelijking

Knoppen:
  [Goedkeuren & Publiceren]  → via API indien mogelijk
  [Kopieer tekst + foto's]    → voor handmatig plakken
  [Opslaan als concept]
  [Archiveren]
```

---

## 8. Bundle-logica

```typescript
// Edge Function suggest-bundles (pseudocode)

async function suggestBundles(newProduct) {
  const suggestions = [];

  // RAM Kit
  if (newProduct.category_slug.startsWith('ram_')) {
    const matches = await findMatchingRam(newProduct);
    if (matches.length >= 1) {
      suggestions.push({
        type: 'ram_kit',
        items: [newProduct, ...matches],
        price: sumValues * 1.10,
        reason: 'Matched kit levert 10% premium op'
      });
    }
  }

  // Console + games
  if (newProduct.category_slug === 'console') {
    const games = await findGamesForPlatform(newProduct.specs.model);
    const lowValue = games.filter(g => g.estimated_value < 7);
    const highValue = games.filter(g => g.estimated_value >= 7);

    if (lowValue.length > 0) {
      suggestions.push({
        type: 'console_bundle',
        items: [newProduct, ...lowValue],
        note: `${highValue.length} games apart verkopen (>€7)`
      });
    }
  }

  // Pokémon: set + bulk
  if (newProduct.category_slug === 'pokemon_card') {
    const sameSet = await findSameSet(newProduct.specs.set_name);
    const bulk = sameSet.filter(c => c.estimated_value < 1);
    const lot = sameSet.filter(c => c.estimated_value >= 1 &&
                                    c.estimated_value <= 20);

    if (bulk.length >= 50) {
      suggestions.push({
        type: 'card_lot',
        items: bulk,
        price: bulk.length * 0.02
      });
    }
    if (lot.length >= 5) {
      suggestions.push({
        type: 'card_lot',
        items: lot,
        price: sumValues * 0.75
      });
    }
  }

  return suggestions;
}
```

---

## 9. App Schermen — Mobiel (Expo Router)

```
apps/mobile/app/
├── (auth)/
│   └── login.tsx
├── (tabs)/
│   ├── _layout.tsx
│   ├── index.tsx                  # Dashboard
│   ├── camera.tsx                 # Camera met 4 modes
│   ├── products.tsx               # Productenlijst
│   ├── listings.tsx               # Advertenties
│   └── settings.tsx
├── product/
│   ├── [id].tsx
│   ├── [id]/edit.tsx
│   └── [id]/listings.tsx
├── listing/
│   ├── [id].tsx                   # Goedkeuringsscherm
│   └── create.tsx
├── bundle/
│   ├── index.tsx
│   ├── [id].tsx
│   └── suggest.tsx
└── price-watch/
    └── index.tsx
```

### Camera Modes (belangrijk)

```typescript
// apps/mobile/app/(tabs)/camera.tsx

type CameraMode = 'product' | 'barcode' | 'mark_macro' | 'detail_damage';

const modeConfig = {
  product: {
    hint: 'Foto van het hele product',
    icon: '📸',
    autoCapture: false
  },
  barcode: {
    hint: 'Richt op barcode, scan automatisch',
    icon: '🔢',
    autoCapture: true,
    scanner: 'expo-barcode-scanner'
  },
  mark_macro: {
    hint: 'Merkteken/stempel — 10cm afstand, schuin licht',
    icon: '🔍',
    autoCapture: false,
    tips: [
      'Schuin licht maakt reliëf zichtbaar',
      'Zwarte achtergrond voor metaal',
      'Gebruik macro-modus'
    ]
  },
  detail_damage: {
    hint: 'Close-up van schade/detail',
    icon: '🔎',
    autoCapture: false
  }
};
```

### Dashboard widgets
- Statistieken: actief / concept / verkocht / totale waarde
- Recente activiteit (tijdlijn)
- Bundles die op goedkeuring wachten
- Prijswatcher alerts
- "Producten zonder EAN" teller (incentive barcode scanner)
- "Antiek in concept — exporteer naar taxateur" knop

### ✅ Claude Code Taken — Sectie 9

```
Taak 9.1: npx create-expo-app@latest apps/mobile --template tabs
Taak 9.2: Installeer dependencies uit sectie 2
Taak 9.3: Implementeer CameraScreen met 4 modes
Taak 9.4: Implementeer dashboard met Supabase Realtime
Taak 9.5: Implementeer product detail + listing goedkeuringsscherm
```

---

## 10. Web Interface — PC (Next.js op Vercel)

```
apps/web/app/
├── (auth)/
│   └── login/page.tsx
├── page.tsx                       # Dashboard
├── products/
│   ├── page.tsx                   # Bulk-tabel
│   └── [id]/page.tsx
├── listings/
│   ├── page.tsx
│   └── [id]/page.tsx
├── upload/
│   └── page.tsx                   # Bulk foto upload
├── bundles/
│   └── page.tsx
├── taxatie/
│   ├── page.tsx                   # Taxatie dossiers
│   └── [id]/preview.tsx           # PDF preview
├── prices/
│   └── page.tsx
├── analytics/
│   └── page.tsx
├── database/
│   └── page.tsx                   # DB browser
└── settings/
    └── page.tsx
```

### Database Browser (PC-exclusief)
Simpele query-interface (read-only) met whitelist van views:
```typescript
const ALLOWED_VIEWS = [
  'products_summary',
  'inventory_value',
  'listings_by_platform',
  'sales_last_30_days',
  'ram_by_generation',
  'pokemon_cards_by_set'
];
```

### Taxatie Workflow (PC-exclusief)
```
1. Selecteer één of meer antiek-items
2. Vul dossier-metadata in
3. Preview PDF in browser
4. [Genereren] → generate-taxatie-pdf
5. Download PDF of verstuur via email
6. PDF opgeslagen in taxatie-pdfs bucket + logged
```

### PDF inhoud voor taxatie
```
╔══════════════════════════════════════╗
║   TAXATIE DOSSIER                    ║
║   {product.title}                    ║
║   Datum: {today}                     ║
╠══════════════════════════════════════╣
║   📸 Productfoto's (voor + achter)   ║
║   🔍 Merktekens (macro)              ║
║   📋 Kenmerken:                      ║
║      - Type / Periode / Materiaal    ║
║      - Afmetingen / Gewicht          ║
║   📜 Herkomst:                       ║
║      {product.provenance_notes}      ║
║   💰 Geschatte marktwaarde:          ║
║      €{min} - €{max}                 ║
║   📞 Contact: {seller_name}          ║
║      WhatsApp: {whatsapp_number}     ║
╚══════════════════════════════════════╝
```

### ✅ Claude Code Taken — Sectie 10

```
Taak 10.1: npx create-next-app@latest apps/web --typescript --tailwind --app
Taak 10.2: shadcn/ui init + installeer recharts, react-table, react-dropzone
Taak 10.3: Implementeer bulk upload met drag-and-drop + auto-grouping
Taak 10.4: Implementeer producten-tabel met bulk-acties
Taak 10.5: Implementeer taxatie PDF flow
Taak 10.6: Deploy naar Vercel via Vercel MCP
```

---

## 11. Klantcommunicatie

### In-app notificaties
Supabase Realtime + Expo Push voor:
- Prijsdaling prijswatcher
- Listing verlopen
- Bundle-suggestie klaar
- Taxatie PDF gegenereerd

### WhatsApp (simpel, zonder Business API)
```typescript
const whatsappLink = `https://wa.me/31${number}?text=${
  encodeURIComponent(`Hoi, ik heb interesse in "${listing.final_title}"`)
}`;
```

### Quick-reply templates (in `app_settings`)
Bewerkbaar op web-app. Mobiel: één-tik-kopiëren.

---

## 12. MCP Servers

### Voor development in Claude Code
| Server | URL | Gebruik |
|--------|-----|---------|
| **Supabase MCP** | `https://mcp.supabase.com/mcp` | Schema, migraties, queries |
| **Vercel MCP** | `https://mcp.vercel.com` | Deployments, logs |
| **Playwright MCP** | via `npx` | Scraping prototyping |
| **Fetch MCP** | via `npx` | Webpagina's ophalen |

### Custom MCP server voor jouw app (Fase 7)
```typescript
// tools/verkoopassistent-mcp/index.ts
const server = new MCPServer('verkoopassistent', {
  tools: [
    { name: 'list_products', inputSchema: { status, category } },
    { name: 'get_product_details', inputSchema: { id } },
    { name: 'generate_listing_for_product', inputSchema: { productId, platform } },
    { name: 'get_inventory_summary' },
    { name: 'find_bundle_candidates' }
  ]
});
```

---

## 13. Kosten

| Service | Plan | Kosten/maand |
|---------|------|-------------|
| Supabase | Free tier | €0 |
| Vercel | Hobby | €0 |
| Claude API (Sonnet) ~200 listings × $0,033 | Pay-as-go | ~$7 |
| Cardmarket / Pokémon TCG / eBay API | Gratis | €0 |
| **Totaal normaal gebruik** | | **~$7** |
| **Totaal zwaar gebruik (1000+ listings)** | Supabase Pro | **~$58** |

---

## 14. Implementatieroadmap voor Claude Code

### 🏁 Fase 1 — Foundation (~2 dagen)
**Doel:** Database draait, auth werkt, lege app structuur staat.

```
[ ] Supabase project aanmaken (Supabase MCP)
[ ] Database schema uitrollen (sectie 3)
[ ] Storage buckets aanmaken
[ ] Monorepo opzetten met pnpm workspaces
[ ] apps/web: Next.js + shadcn/ui + Supabase SSR auth
[ ] apps/mobile: Expo + expo-router + Supabase auth
[ ] packages/shared: types + zod schemas
[ ] .env.example + .env.local
[ ] Deploy apps/web naar Vercel (Vercel MCP)

Verificatie: inloggen werkt op beide apps met magic link.
```

### 📸 Fase 2 — Camera & Upload (~2 dagen)
```
[ ] CameraScreen mobiel met 4 modes (product/barcode/mark_macro/detail)
[ ] expo-barcode-scanner → fills products.ean
[ ] Foto upload naar Supabase Storage
[ ] Bulk upload web met drag-and-drop + auto-grouping
[ ] Productenlijst mobiel + web
[ ] Product detail scherm

Verificatie: 5 foto's maken op telefoon → meteen zichtbaar op pc.
```

### 🤖 Fase 3 — AI Pipeline (~3 dagen)
```
[ ] Edge Function lookup-ean (Tweakers scraper)
[ ] Edge Function analyze-product (Claude Sonnet Vision)
[ ] Edge Function generate-listing (per platform)
[ ] Edge Function fetch-prices
[ ] Review/goedkeuringsscherm mobiel
[ ] Listing editor web (split-view)
[ ] Gebreken + accessoires velden in UI

Verificatie: RAM foto → app herkent DDR3 8GB Corsair → stelt prijs voor →
             genereert Marktplaats tekst.
```

### 🔗 Fase 4 — Platform Integraties (~3 dagen)
```
[ ] Cardmarket API v2 (OAuth 1.0)
[ ] eBay API (OAuth 2.0)
[ ] Tweakers V&A scraper (of copy-paste knop)
[ ] Marktplaats API aanvragen + integreren
[ ] Edge Function publish-listing
[ ] Status tracking

Verificatie: kaart → Cardmarket listing live <30 seconden.
```

### 💰 Fase 5 — Bundles, Opkoop & Watcher (~2 dagen)
```
[ ] Bundle-suggestie Edge Function
[ ] Bundle manager web + mobiel
[ ] Edge Function fetch-buyback-quotes
[ ] Opkoopdiensten-vergelijking in product detail
[ ] Prijswatcher met pg_cron
[ ] Push notificaties via Expo

Verificatie: console toegevoegd → bundle-suggestie met games <€7 +
             levelseven.nl opkoopprijs ter vergelijking.
```

### 🏛️ Fase 6 — Antiek & Taxatie (~2 dagen)
```
[ ] Merkteken macro-camera modus met tips
[ ] Edge Function identify-antique
    (Nederlandse TinVereniging + Zilver.nl lookup)
[ ] Edge Function generate-taxatie-pdf (react-pdf)
[ ] Taxatie workflow op web
[ ] PDF preview scherm
[ ] Email integratie (optioneel)

Verificatie: tinnen kan → merkteken scan → identificatie → PDF →
             klaar voor taxateur.
```

### 🎨 Fase 7 — Afwerking (~2 dagen)
```
[ ] Statistieken dashboard web (recharts)
[ ] Database browser web
[ ] Offline support mobiel (react-query persistQueryClient)
[ ] Custom MCP server voor Claude Code
[ ] Error monitoring (Sentry free tier)
[ ] Backup strategie (Supabase daily backups)

Verificatie: vanuit Claude Code: "Welke producten heb ik deze week verkocht?"
```

---

## 15. Startcommando's voor Claude Code

Plaats dit bestand (`PLAN.md`) in de root van je project en gebruik deze prompts:

### Helemaal nieuw starten
```
Ik wil de verkoopassistent app bouwen zoals beschreven in PLAN.md.
Start met Fase 1 (Foundation):
1. Maak de monorepo structuur aan
2. Gebruik de Supabase MCP om een nieuw project aan te maken
3. Rol het volledige database schema uit uit sectie 3
4. Verifieer dat alle tabellen zijn aangemaakt

Rapporteer wat je hebt gedaan en wat de volgende stap is.
```

### Per fase verder
```
PLAN.md staat in de root. Fase 1 is af. Begin nu Fase 2.
Implementeer alle taken in de Fase 2 checklist.
Begin met apps/mobile CameraScreen.
```

### Specifieke taak
```
Implementeer Edge Function `analyze-product` zoals beschreven in
PLAN.md sectie 6. Gebruik Claude Sonnet 4.6 (claude-sonnet-4-6).
Input: { productId, photoIds, analysisType }.
Output: JSON volgens schema in sectie 7 stap 2.
Sla analyse op in ai_analyses tabel.
```

### Debuggen
```
Ik krijg een error in apps/web bij /products.
Gebruik de Supabase MCP om te controleren of products tabel bestaat
en de juiste RLS policies heeft volgens PLAN.md sectie 3.
```

---

## 16. Belangrijke Ontwerpbeslissingen

| Beslissing | Waarom |
|-----------|--------|
| Solo gebruiker, geen multi-tenant | Simpeler schema + RLS |
| Supabase over Neon | Alles-in-één |
| Expo over React Native CLI | Snellere setup, OTA updates |
| Next.js App Router | Server components, betere Supabase SSR |
| pnpm workspaces | Shared types zonder publishing |
| pg_cron over externe scheduler | Geen extra service |
| Claude Sonnet default | Betere identificatie antiek + kaarten |
| Expliciete goedkeuring vereist | Voorkomt fouten + EU wet |
| EAN-scanner eerst, AI als fallback | 80% elektronica heeft EAN |

---

*Einde PLAN.md. Versie 1.0 — Klaar voor Claude Code.*
