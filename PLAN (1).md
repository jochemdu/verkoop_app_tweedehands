# VerkoopAssistent — Volledig Technisch Plan

*Persoonlijke inventaris- en verkoopmanager voor tweedehands spullen — NL markt*
*Geoptimaliseerd voor gebruik met Claude Code en Claude Desktop*

---

## Snelle Start voor Claude Code

```
# 1. Plaats dit bestand als PLAN.md in de root van je project
# 2. Start Claude Code in de projectmap
# 3. Vraag Claude Code:
#    "Lees PLAN.md en implementeer Fase 1 (Foundation)"
```

---

## 🎯 Kernfilosofie — BELANGRIJKE WIJZIGING

Deze app werkt in **twee duidelijk gescheiden fases**:

### Fase A — Indexeren (inventariseren)

Je loopt met je telefoon langs je spullen, plakt genummerde stickers op elk item, maakt foto's. De app slaat alles op met het sticker-ID gekoppeld. **Nog geen verkoop, nog geen prijzen, nog geen advertenties.** Doel: een complete fotocatalogus van alles wat je hebt.

### Fase B — Verkoop voorbereiden (analyse & bundeling)

Als je klaar bent met indexeren, open je Claude Desktop of Claude Code. Via een **custom MCP server** krijgt Claude toegang tot je inventaris-database. Jij vraagt dan bijvoorbeeld:

> "Bekijk de foto's van sticker 0042 t/m 0067 en bedenk welke items samen een logische bundel vormen voor Marktplaats."

> "Welke RAM-modules in mijn inventaris zijn compatibel als kit? Geef me de sticker-nummers."

> "Analyseer de pokémon-kaarten met sticker 0100-0150 en maak een verkoopstrategie."

Claude kijkt dan naar de foto's (niet via Vision API, maar omdat jij ze deelt in het gesprek) en komt met bundel-suggesties, advertentieteksten en prijsadviezen.

### Wat er weggaat

- ❌ Geen `analyze-product` Edge Function met Claude Vision API
- ❌ Geen automatische productherkenning bij upload
- ❌ Geen automatisch gegenereerde advertenties
- ❌ Geen AI-kosten meer (Claude Vision API afgeschaft)

### Wat er bij komt

- ✅ Sticker-ID systeem met drie input-methoden
- ✅ A4 stickervel generator
- ✅ Custom MCP server als primaire interface voor analyse
- ✅ Twee-fasen workflow (eerst indexeren, dan verkopen)
- ✅ Inventaris-focused UI

---

## 1. Architectuuroverzicht (aangepast)

```
┌─────────────────────────────────────────────────────────────────┐
│                    JOUW DEVICES                                  │
│                                                                  │
│  📱 Expo App                💻 Next.js Web (Vercel)             │
│                                                                  │
│  FASE A — Indexeren:        FASE A — Indexeren:                 │
│  • Foto's maken             • Bulk upload vanaf pc              │
│  • Sticker-ID koppelen      • Stickervel PDF genereren          │
│    (OCR / typen / foto)     • Inventaris tabel                  │
│                                                                  │
│  FASE B — Verkoop:          FASE B — Verkoop:                   │
│  • Bundels goedkeuren       • Bundels beheren                   │
│  • Advertenties plakken     • Advertenties bewerken             │
│  • Status bijhouden         • PDF exports (taxatie)             │
└──────────────┬──────────────────────────┬───────────────────────┘
               │                          │
               └──────────┬───────────────┘
                          │
         ┌────────────────▼────────────────────┐
         │           SUPABASE                  │
         │                                     │
         │  🗄️  PostgreSQL Database            │
         │  🔐  Auth (magic link)              │
         │  📁  Storage (foto's + PDFs)        │
         │  ⚡  Edge Functions                 │
         │      (NIET voor AI-analyse)         │
         └──────────────┬──────────────────────┘
                        │
                        │ (MCP protocol)
                        │
         ┌──────────────▼──────────────────┐
         │   Custom MCP Server             │
         │   "verkoopassistent-mcp"        │
         │                                 │
         │   Tools:                        │
         │   • list_inventory              │
         │   • get_product_photos          │
         │   • suggest_bundle              │
         │   • create_listing              │
         │   • search_products             │
         └──────────────┬──────────────────┘
                        │
         ┌──────────────▼──────────────────┐
         │   Claude Desktop / Claude Code  │
         │                                 │
         │   JIJ analyseert foto's,        │
         │   suggereert bundels, schrijft  │
         │   advertenties via chat         │
         └─────────────────────────────────┘
```

### Waarom dit werkt

- **Jij (Claude) ziet foto's** als ze in het gesprek worden gedeeld — geen aparte Vision API nodig
- **MCP server** geeft Claude structured access tot de database (welke producten, welke foto's, welke bundels)
- **Claude Desktop** is ideaal voor interactieve analyse met foto's
- **Claude Code** is ideaal voor bulk-operaties ("genereer advertenties voor alle RAM")
- **Geen recurring AI-kosten** want je betaalt al voor Claude Pro/Max

---

## 2. Tech Stack (aangepast)

### Mobiele App (Expo)

| Pakket | Gebruik |
|--------|---------|
| `expo` SDK 55 | Framework |
| `expo-router` v7 | File-based navigatie |
| `expo-camera` | Camera + foto's maken |
| `expo-barcode-scanner` | EAN barcode scannen |
| **`@react-native-ml-kit/text-recognition`** | **On-device OCR voor stickers** (nieuw) |
| `expo-image-picker` | Galerij multi-select |
| `expo-image-manipulator` | Resize voor upload |
| `expo-image` | Geoptimaliseerde weergave |
| `expo-notifications` | Push notificaties |
| `@supabase/supabase-js` v2 | Database + Auth + Storage |
| `react-native-mmkv` | Lokale opslag (laatste gebruikte sticker-ID) |
| `zustand` v4 | State management |
| `@tanstack/react-query` v5 | Server state + caching |

### Web App (Next.js op Vercel)

| Pakket | Gebruik |
|--------|---------|
| `next` v14+ (App Router) | Framework |
| `@supabase/supabase-js` + `@supabase/ssr` | Database + Auth |
| `tailwindcss` v4 + `shadcn/ui` | Styling |
| `recharts` | Grafieken |
| `@tanstack/react-table` | Bulk-tabel |
| `react-dropzone` | Drag & drop foto upload |
| `react-hook-form` + `zod` | Formulieren |
| `@react-pdf/renderer` | **PDF voor taxatie + stickervel** (dubbel gebruik) |

### Custom MCP Server (nieuw)

| Pakket | Gebruik |
|--------|---------|
| `@modelcontextprotocol/sdk` | MCP server framework |
| `@supabase/supabase-js` | Database toegang |
| `tsx` | TypeScript runner |
| Draait **lokaal** via Claude Desktop config | Geen hosting nodig |

### Backend (Supabase Edge Functions — Deno/TypeScript)

Alleen nog voor écht server-side werk — geen AI meer:

| Functie | Beschrijving |
|---------|-------------|
| `lookup-ean` | EAN/barcode → Tweakers prijs + productinfo |
| `fetch-prices` | Marktplaats/Tweakers/Cardmarket/eBay prijzen |
| `fetch-buyback-quotes` | Opkoopdiensten-prijzen |
| `identify-card-by-id` | Pokémon kaart-ID → Cardmarket EUR prijs |
| `lookup-silver-hallmark` | Zilver.nl keurmerk lookup |
| `lookup-tin-mark` | TinVereniging merkteken lookup |
| `publish-listing` | Advertentie publiceren via platform-API |
| `generate-taxatie-pdf` | PDF-dossier voor taxateur |
| `generate-sticker-sheet` | **Stickervel PDF genereren** (nieuw) |
| `price-watcher-cron` | Prijzen bijwerken via pg_cron |

---

## 3. Sticker-ID Systeem

### Stickervel Layout

A4 portrait, verdeeld in 4 kwartieren (2×2 grid). Elk kwartier heeft 40 stickers in 5 kolommen × 8 rijen.

```
┌─────────────────────────────────┐
│  Kwartier 1     │  Kwartier 2   │  ← Elk kwartier: 105×148mm
│  40 stickers    │  40 stickers  │
│  0001-0040      │  0041-0080    │
├─────────────────┼───────────────┤
│  Kwartier 3     │  Kwartier 4   │
│  40 stickers    │  40 stickers  │
│  0081-0120      │  0121-0160    │
└─────────────────────────────────┘

Totaal: 160 stickers per A4-vel
```

**Sticker afmetingen:** 21×15mm per sticker (middel), 4-cijferig nummer in een goed leesbaar lettertype (bijv. **JetBrains Mono Bold** of **Source Code Pro Bold**, 11pt zwart op wit). Rondom elke sticker 1mm marge zodat je makkelijk kunt uitknippen.

### Stickervel-generator

De web-app genereert een PDF met een startnummer. Je kiest bijvoorbeeld "start bij 0001" → 160 stickers tot 0160. Volgende keer "start bij 0161" etc.

```typescript
// Edge Function: generate-sticker-sheet
// Input:  { startNumber: 1, count: 160 }
// Output: { pdfUrl: "..." } (signed URL, 1 uur geldig)

// De PDF:
// - A4 portrait
// - 4 kwartieren met 40 stickers elk (5 cols × 8 rows)
// - 4-cijferig zero-padded: 0001, 0002, ...
// - Snijlijnen tussen stickers (optioneel)
// - Header per kwartier met range (bijv "0001-0040")
```

### Sticker-koppeling bij fotograferen (3 modi beschikbaar)

```typescript
// apps/mobile/lib/stickerCapture.ts

type StickerMode = 'ocr_inline' | 'ocr_separate_photo' | 'manual_increment';

// MODE A: OCR uit productfoto
// Je plakt sticker op product. Maakt een normale productfoto.
// App scant op de achtergrond de foto met ML Kit OCR.
// Detecteert 4-cijferige nummers automatisch.
// Kans op mis-detectie: gebruiker krijgt bevestiging voor opslaan.

// MODE B: Aparte sticker-foto eerst
// Stap 1: close-up foto van alleen de sticker
//         → ML Kit OCR leest nummer met hoge zekerheid
//         → Sessie wordt gekoppeld aan dit nummer
// Stap 2-N: productfoto's (sticker hoeft niet meer zichtbaar)

// MODE C: Handmatig met auto-increment
// Je typt eerst 0042 bij sessie-start.
// Volgende sessie stelt de app automatisch 0043 voor.
// Je kunt altijd afwijken.
```

### Database ondersteuning

Zie sectie 4 voor het volledige schema. Kernvelden:

- `products.sticker_id` (TEXT UNIQUE, 4-cijferig)
- `products.sticker_input_method` ('ocr_inline' / 'ocr_separate' / 'manual')
- `products.sticker_confidence` (DECIMAL, bij OCR: hoe zeker is de herkenning)
- `photos.sticker_visible` (BOOLEAN, of sticker op deze foto zichtbaar is)
- `sticker_sheets` (tabel met uitgeprinte vellen om dubbele uitgifte te voorkomen)

### ✅ Claude Code Taken — Sectie 3

```
Taak 3.1: Implementeer generate-sticker-sheet Edge Function met @react-pdf/renderer.
          Test door PDF te genereren met nummers 0001-0160.
Taak 3.2: Voeg sticker PDF-download knop toe op web-app settings pagina.
Taak 3.3: Installeer @react-native-ml-kit/text-recognition in apps/mobile.
Taak 3.4: Implementeer 3 stickerCapture modes in apps/mobile/lib/stickerCapture.ts.
```

---

## 4. Database Schema (Supabase PostgreSQL)

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

-- AANGEPAST: nieuwe statussen voor 2-fasen flow
CREATE TYPE product_status AS ENUM (
  'indexed',         -- Fase A: opgenomen in inventaris, nog geen verkoopintentie
  'analyzing',       -- Claude bekijkt via MCP
  'ready_to_list',   -- Analyse gedaan, klaar om te verkopen
  'pending_review',  -- Advertentietekst klaar, wacht op jouw goedkeuring
  'approved',        -- Goedgekeurd, nog niet geplaatst
  'listed',          -- Actief op >= 1 platform
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
  'sticker'           -- nieuw: foto van alleen de sticker
);

CREATE TYPE sticker_input_method AS ENUM (
  'ocr_inline',       -- OCR uit productfoto
  'ocr_separate',     -- Aparte sticker-foto
  'manual',           -- Handmatig getypt
  'manual_increment'  -- Auto-incremented vanaf vorige
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
```

### Sticker sheets (nieuw)

```sql
CREATE TABLE sticker_sheets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_number  INTEGER NOT NULL,
  end_number    INTEGER NOT NULL,
  sheet_count   INTEGER DEFAULT 1,    -- hoeveel vellen uitgeprint
  pdf_storage_path TEXT,
  printed_at    TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(start_number)
);
```

### Platforms, categories, buyback_services

*(Zelfde als vorige plan — zie eerdere PLAN.md voor volledige INSERT statements)*

```sql
CREATE TABLE platforms (...);
CREATE TABLE buyback_services (...);
CREATE TABLE categories (...);
```

### Producten (grondig aangepast)

```sql
CREATE TABLE products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sticker-ID (nieuw, primaire identifier naast UUID)
  sticker_id            TEXT UNIQUE,                -- '0042', 4-cijferig
  sticker_input_method  sticker_input_method,
  sticker_confidence    DECIMAL,                    -- bij OCR: 0.0-1.0

  -- Fase A: Indexering
  category_slug         category_slug REFERENCES categories(slug)
                        DEFAULT 'unknown',
  working_title         TEXT,                       -- jouw ruwe omschrijving
  indexing_notes        TEXT,                       -- korte aantekening bij opname

  -- Fase B: Verkoop (pas ingevuld bij analyse)
  title                 TEXT,                       -- definitieve titel
  description           TEXT,
  condition             product_condition,
  specs                 JSONB DEFAULT '{}',
  defects               TEXT[] DEFAULT '{}',
  included_accessories  TEXT[] DEFAULT '{}',
  missing_items         TEXT[] DEFAULT '{}',

  -- EAN/barcode
  ean                   TEXT,
  barcode_type          TEXT,
  identified_via        TEXT,                       -- 'barcode', 'claude_analysis', 'manual'

  -- Waardering (ingevuld tijdens analyse)
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
  indexed_at            TIMESTAMPTZ DEFAULT NOW(),  -- wanneer toegevoegd aan inventaris
  analyzed_at           TIMESTAMPTZ,                -- wanneer Claude analyse deed
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

CREATE INDEX idx_products_sticker ON products(sticker_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category_slug);
CREATE INDEX idx_products_ean ON products(ean) WHERE ean IS NOT NULL;
CREATE INDEX idx_products_indexed_at ON products(indexed_at DESC);
```

### Foto's (aangepast)

```sql
CREATE TABLE photos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  storage_path      TEXT NOT NULL,
  thumbnail_path    TEXT,
  order_index       INTEGER DEFAULT 0,
  photo_type        photo_type DEFAULT 'general',
  capture_mode      TEXT,                           -- 'normal', 'macro_mark', 'detail', 'barcode', 'sticker'

  -- Sticker detectie (nieuw)
  sticker_visible   BOOLEAN DEFAULT false,          -- is de sticker zichtbaar op deze foto
  detected_sticker  TEXT,                           -- wat OCR las, kan afwijken van uiteindelijk gekoppelde sticker
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
```

### Overige tabellen

```sql
-- Opkoop-offertes (zelfde als vorige plan)
CREATE TABLE buyback_quotes (...);

-- Listings (zelfde als vorige plan)
CREATE TABLE listings (...);

-- Prijsgeschiedenis (zelfde)
CREATE TABLE price_history (...);

-- Bundles (aangepast: meer metadata)
CREATE TABLE bundles (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  TEXT NOT NULL,
  description            TEXT,
  bundle_type            bundle_type DEFAULT 'custom',
  suggested_by           TEXT DEFAULT 'user',    -- 'user' | 'claude_mcp'
  claude_reasoning       TEXT,                   -- waarom Claude deze bundel suggereerde
  total_individual_value DECIMAL,
  suggested_price        DECIMAL,
  status                 product_status DEFAULT 'ready_to_list',
  notes                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bundle_items (
  bundle_id   UUID REFERENCES bundles(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  position    INTEGER DEFAULT 0,
  PRIMARY KEY (bundle_id, product_id)
);

-- Claude analyses log (AANGEPAST, niet meer Vision API)
CREATE TABLE claude_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_type   TEXT,                   -- 'identification','bundle_suggestion','pricing','description'
  subject_products UUID[],                -- welke producten Claude analyseerde
  claude_source   TEXT,                   -- 'claude_desktop' | 'claude_code' | 'web_chat'
  user_prompt     TEXT,                   -- wat jij aan Claude vroeg
  claude_response JSONB,                  -- Claude's output
  applied         BOOLEAN DEFAULT false,  -- of jij het suggestieresultaat hebt overgenomen
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Prijswatchers, taxatie_exports, app_settings (zelfde als vorig plan)
CREATE TABLE price_watches (...);
CREATE TABLE taxatie_exports (...);
CREATE TABLE app_settings (...);
```

### RLS (zelfde als vorig plan, alle tabellen alleen authenticated)

### ✅ Claude Code Taken — Sectie 4

```
Taak 4.1: Rol het volledige schema uit via Supabase MCP.
Taak 4.2: Verifieer alle enums met: SELECT typname FROM pg_type
          WHERE typtype = 'e';
Taak 4.3: Test insert met sticker_id='0001' en lees terug.
```

---

## 5. Projectstructuur

```
verkoopassistent/
├── PLAN.md
├── .env.example
├── supabase/
│   ├── migrations/
│   │   └── 0001_initial_schema.sql
│   ├── functions/
│   │   ├── lookup-ean/
│   │   ├── fetch-prices/
│   │   ├── fetch-buyback-quotes/
│   │   ├── identify-card-by-id/
│   │   ├── lookup-silver-hallmark/
│   │   ├── lookup-tin-mark/
│   │   ├── publish-listing/
│   │   ├── generate-taxatie-pdf/
│   │   ├── generate-sticker-sheet/
│   │   └── price-watcher-cron/
│   └── config.toml
├── packages/
│   ├── shared/                        ← gedeelde types (web + mobile + mcp)
│   └── mcp-server/                    ← custom MCP server voor Claude
│       ├── src/
│       │   ├── index.ts
│       │   ├── tools/
│       │   │   ├── list_inventory.ts
│       │   │   ├── get_product_photos.ts
│       │   │   ├── search_products.ts
│       │   │   ├── suggest_bundle.ts
│       │   │   ├── create_listing.ts
│       │   │   └── update_product.ts
│       │   └── lib/
│       │       └── supabase.ts
│       ├── package.json
│       └── README.md                  ← installatie in Claude Desktop
├── apps/
│   ├── web/                           ← Next.js (Vercel)
│   └── mobile/                        ← Expo
└── package.json                       ← pnpm workspace
```

---

## 6. Custom MCP Server — Kernstuk van Fase B

De MCP server is het belangrijkste onderdeel sinds we Claude Vision API niet meer gebruiken. Via deze server kan Claude Desktop (of Claude Code) met jouw inventaris werken.

### Installatie in Claude Desktop

Je voegt dit toe aan `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) of `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "verkoopassistent": {
      "command": "npx",
      "args": ["tsx", "/pad/naar/verkoopassistent/packages/mcp-server/src/index.ts"],
      "env": {
        "SUPABASE_URL": "https://xxxxx.supabase.co",
        "SUPABASE_SERVICE_KEY": "eyJhb..."
      }
    }
  }
}
```

### Beschikbare Tools

```typescript
// packages/mcp-server/src/tools/list_inventory.ts
{
  name: 'list_inventory',
  description: 'Lijst producten uit inventaris met filters',
  inputSchema: {
    status: 'indexed | ready_to_list | listed | sold | archived',
    category: 'optioneel',
    sticker_range_start: 'optioneel, bijv 0042',
    sticker_range_end: 'optioneel, bijv 0067',
    limit: 'default 50'
  }
}

// get_product_photos.ts
{
  name: 'get_product_photos',
  description: 'Haal foto-URLs op van een product (signed URLs, 1u geldig). Claude kan deze URLs zien als je ze in het gesprek deelt.',
  inputSchema: {
    product_id: 'uuid | sticker_id'
  }
}

// search_products.ts
{
  name: 'search_products',
  description: 'Vrije zoekopdracht in producten',
  inputSchema: {
    query: 'tekst, matcht op title/working_title/notes/specs',
    category: 'optioneel'
  }
}

// suggest_bundle.ts
{
  name: 'suggest_bundle',
  description: 'Maak een bundle-voorstel in de database. Status blijft draft.',
  inputSchema: {
    title: 'bundle titel',
    product_ids_or_stickers: ['uuid of sticker_id'],
    suggested_price: 'optioneel',
    reasoning: 'waarom deze items samen'
  }
}

// create_listing.ts
{
  name: 'create_listing',
  description: 'Maak een draft advertentie voor product + platform. Status: pending_review.',
  inputSchema: {
    product_id: 'uuid | sticker_id',
    platform: 'marktplaats | tweakers | cardmarket | ebay',
    title: 'advertentie titel',
    description: 'advertentie tekst',
    price: 'in EUR'
  }
}

// update_product.ts
{
  name: 'update_product',
  description: 'Werk productgegevens bij (specs, condition, title, etc.)',
  inputSchema: {
    product_id: 'uuid | sticker_id',
    updates: '{ title?, condition?, specs?, defects?, ... }'
  }
}
```

### Typische workflow met Claude Desktop

```
Jij:    "Laat me de inventaris zien van sticker 0042 t/m 0060"

Claude: [roept list_inventory aan met sticker_range_start='0042',
         sticker_range_end='0060']
        "Ik zie 19 producten in dat bereik. 12 zijn al gecategoriseerd
         (7x RAM, 3x Pokémon kaarten, 2x consoles), 7 staan als
         'unknown'. Wil je dat ik de foto's van de unknowns bekijk?"

Jij:    "Ja graag"

Claude: [roept get_product_photos aan voor elk unknown product]
        [ontvangt signed URLs, rendert foto's in het gesprek]
        "Op basis van de foto's:
        - Sticker 0045: antieke tinnen kandelaar met merkteken
        - Sticker 0048: DDR2 SODIMM 2GB Samsung
        - Sticker 0052: PlayStation 2 controller (Dual Shock)
        ...
        Zal ik deze categoriseren?"

Jij:    "Ja, en stel een bundel voor met alle RAM die compatibel is"

Claude: [roept update_product aan voor de 7 items]
        [roept list_inventory aan met category='ram_dimm' en 'ram_sodimm']
        [analyseert specs]
        [roept suggest_bundle aan]
        "Ik heb een bundel 'DDR2 SODIMM 8GB Kit (4×2GB Samsung)'
         aangemaakt met stickers 0048, 0051, 0058, 0061.
         Voorgestelde prijs: €45 (matched kit premium)."
```

### ✅ Claude Code Taken — Sectie 6

```
Taak 6.1: Zet packages/mcp-server op met @modelcontextprotocol/sdk.
Taak 6.2: Implementeer alle 6 tools.
Taak 6.3: Test lokaal met: npx @modelcontextprotocol/inspector
          tsx src/index.ts
Taak 6.4: Voeg README toe met installatie-instructies voor Claude Desktop
          en Claude Code.
```

---

## 7. Twee-Fasen Workflow

### Fase A — Indexeren

```
Stap 1: Print stickervel (via web-app)
        → generate-sticker-sheet genereert PDF
        → Uitprinten, uitknippen

Stap 2: Plak sticker op product
        → Schrijf het nummer in stikkervel-tracking (optioneel)

Stap 3: Maak foto's (mobiele app)
        → Kies sticker-modus:
          A) OCR inline (sticker in productfoto)
          B) Aparte sticker-foto eerst
          C) Handmatig typen
        → Maak 2-8 productfoto's
        → Optioneel: barcode scannen, merkteken macro, schade detail
        → Optioneel: korte notitie ("kast in garage links")

Stap 4: Opslaan
        → status = 'indexed'
        → category_slug = 'unknown' als onbekend
        → Geen prijsopzoek, geen AI-analyse, geen advertentie
```

### Fase B — Verkoop voorbereiden (via Claude Desktop / Code)

```
Stap 1: Open Claude Desktop of Claude Code
        → MCP server is actief

Stap 2: Vraag Claude om inventaris-analyse
        "Welke items in mijn inventaris zijn nog 'indexed' (unknown)
         en niet gecategoriseerd? Bekijk de foto's en categoriseer ze."

Stap 3: Claude gebruikt MCP tools:
        - list_inventory → vindt unknowns
        - get_product_photos → bekijkt foto's (jij ziet ze ook)
        - update_product → categoriseert

Stap 4: Vraag Claude om bundle-analyse
        "Welke producten passen goed samen als bundel?"
        → Claude bekijkt compatibele RAM, console+games combos,
          kaart-collecties per set
        → Claude roept suggest_bundle aan met reasoning

Stap 5: Vraag Claude om prijsonderzoek (via Edge Functions)
        "Zoek de tweedehandsprijzen op voor bundle X"
        → Claude roept (via MCP) een wrapper rond fetch-prices aan

Stap 6: Vraag Claude om advertenties
        "Schrijf Marktplaats-advertentie voor bundle X"
        → Claude genereert tekst, roept create_listing aan
        → Status wordt 'pending_review'

Stap 7: Goedkeuren in web-app of mobiele app
        → Bekijk listing
        → Bewerk indien nodig
        → [Publiceren] → publish-listing Edge Function
```

### ✅ Claude Code Taken — Sectie 7

```
Taak 7.1: Maak een 'Workflow guide' pagina op de web-app
          die de 2-fasen-flow uitlegt.
Taak 7.2: Maak een dashboard-widget "Klaar voor analyse"
          die toont hoeveel items nog 'indexed' staan.
```

---

## 8. App Schermen

### Mobiele app — Gefocust op Fase A (indexeren)

```
apps/mobile/app/
├── (auth)/login.tsx
├── (tabs)/
│   ├── _layout.tsx
│   ├── index.tsx              # Dashboard: recent geïndexeerd + teller
│   ├── capture.tsx            # KERN: camera + sticker flow
│   ├── inventory.tsx          # Lijst/grid van geïndexeerde items
│   ├── listings.tsx           # Actieve advertenties (status tracking)
│   └── settings.tsx
├── product/
│   ├── [sticker].tsx          # Navigeren via sticker-ID
│   └── [sticker]/edit.tsx
├── listing/
│   └── [id].tsx               # Goedkeuringsscherm voor advertenties
└── settings/
    └── sticker-mode.tsx       # Standaard sticker-methode instellen
```

### Capture scherm (kern van mobiele app)

```
┌─────────────────────────────┐
│ ← Sessie #12 (sticker 0043) │
├─────────────────────────────┤
│                             │
│                             │
│      [CAMERA PREVIEW]       │
│                             │
│                             │
├─────────────────────────────┤
│ Mode: [📸 Product ▼]        │
│       [🔢 Sticker]          │
│       [🏷️ Merkteken macro]  │
│       [🔎 Detail/schade]    │
│       [1️⃣ Barcode EAN]      │
├─────────────────────────────┤
│ Foto's deze sessie: 3       │
│ [thumb] [thumb] [thumb]     │
├─────────────────────────────┤
│         [Opname]            │
│  [Sessie afsluiten]         │
└─────────────────────────────┘
```

Bij sessie-start: keuze sticker-methode:

```
┌─────────────────────────────┐
│ Nieuwe productsessie        │
│                             │
│ Sticker-ID:                 │
│                             │
│ [A] OCR uit productfoto     │
│     (app leest nummer       │
│      automatisch)           │
│                             │
│ [B] Eerst sticker-foto      │
│     (hogere zekerheid)      │
│                             │
│ [C] Handmatig typen         │
│     Laatst gebruikt: 0042   │
│     Volgende: 0043 [typ]    │
│                             │
│ [Start sessie]              │
└─────────────────────────────┘
```

### Web app — Gefocust op Fase B (analyse + verkoop)

```
apps/web/app/
├── (auth)/login/page.tsx
├── page.tsx                       # Dashboard
├── inventory/
│   ├── page.tsx                   # Bulk-tabel van alle items
│   └── [sticker]/page.tsx         # Product detail
├── listings/
│   ├── page.tsx                   # Bulk-beheer advertenties
│   └── [id]/page.tsx
├── bundles/
│   └── page.tsx                   # Bundle manager
├── upload/
│   └── page.tsx                   # Bulk foto upload van pc
├── stickers/
│   └── page.tsx                   # Stickervel PDF generator
├── taxatie/
│   ├── page.tsx
│   └── [id]/preview.tsx
├── prices/page.tsx
├── analytics/page.tsx
├── database/page.tsx              # Read-only query interface
└── settings/page.tsx
```

### Stickervel generator scherm

```
┌──────────────────────────────────────┐
│ Stickervel genereren                 │
├──────────────────────────────────────┤
│ Laatst gebruikt: 0160                │
│ Volgende start: 0161                 │
│                                      │
│ Startnummer:  [0161]                 │
│ Aantal:       [160]                  │
│                                      │
│ [Voorbeeld PDF]  [Genereer & Print]  │
│                                      │
│ Eerder geprint:                      │
│ • 0001-0160  (3 januari)             │
│ • 0161-0320  (nog niet)              │
└──────────────────────────────────────┘
```

### ✅ Claude Code Taken — Sectie 8

```
Taak 8.1: Implementeer mobiele CaptureScreen met 5 camera-modi.
Taak 8.2: Implementeer sticker-mode selector bij sessie-start.
Taak 8.3: Implementeer ML Kit OCR integratie met confidence threshold.
Taak 8.4: Implementeer web stickers/page.tsx met PDF preview.
Taak 8.5: Implementeer web inventory tabel met sticker-range filter.
```

---

## 9. Supabase Edge Functions

### `generate-sticker-sheet` (nieuw)

```typescript
// Input: { startNumber: number, count: number }
// Output: { pdfUrl: string } signed URL
//
// Genereert A4 PDF met 4 kwartieren, elk 40 stickers (5×8 grid).
// Font: JetBrains Mono Bold 11pt.
// Sticker afmeting: 21×15mm.
// Snijlijnen tussen stickers (dashed, 0.25mm, #ccc).
// Header per kwartier: range "0001-0040" etc.
//
// Slaat PDF op in taxatie-pdfs bucket + record in sticker_sheets tabel.
```

### `lookup-ean`, `fetch-prices`, `fetch-buyback-quotes`

*(Zelfde als vorig plan)*

### `identify-card-by-id` (aangepast, niet meer Vision)

```typescript
// Input: { setName, cardNumber, cardName? }  ← jij vult in via Claude
// Output: { tcgApiId, cardmarketId, trendPrice, lowPrice, avgSellPrice }
//
// Deze functie doet ALLEEN lookup, geen herkenning uit foto.
// Claude leest zelf de kaart uit de foto en geeft set+nummer door.
```

### `lookup-silver-hallmark`, `lookup-tin-mark`

```typescript
// Input: { markText: "bijv ANNO 1762 D.B.", category: 'tin' | 'silver' }
// Output: { matches: [{ maker, period, region, source, confidence }] }
//
// Raadpleegt:
// - Nederlandse TinVereniging database (gescrapt/gecached)
// - Zilver.nl keurmerken database
//
// Claude bekijkt de macro-foto van het merkteken en typt de tekst over.
// Deze functie zoekt dan in de database.
```

### `generate-taxatie-pdf`, `publish-listing`, `price-watcher-cron`

*(Zelfde als vorig plan)*

### ✅ Claude Code Taken — Sectie 9

```
Taak 9.1: Implementeer generate-sticker-sheet met @react-pdf/renderer.
Taak 9.2: Implementeer lookup-ean (Tweakers scraper).
Taak 9.3: Implementeer lookup-silver-hallmark met Zilver.nl scraping.
Taak 9.4: Implementeer lookup-tin-mark met TinVereniging scraping.
```

---

## 10. Stickervel PDF Specificatie

```typescript
// supabase/functions/generate-sticker-sheet/lib/pdfLayout.ts

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;

const QUARTERS = [
  { x: 0, y: 0, label: 'kwartier_1' },          // linksboven
  { x: 105, y: 0, label: 'kwartier_2' },        // rechtsboven
  { x: 0, y: 148.5, label: 'kwartier_3' },      // linksonder
  { x: 105, y: 148.5, label: 'kwartier_4' }     // rechtsonder
];

const QUARTER_WIDTH = 105;      // mm
const QUARTER_HEIGHT = 148.5;   // mm

const GRID_COLS = 5;
const GRID_ROWS = 8;
const STICKER_WIDTH = 21;       // mm
const STICKER_HEIGHT = 15;      // mm

const QUARTER_PADDING_TOP = 4;  // mm (voor header)
const QUARTER_PADDING_SIDES = 0;

const STICKERS_PER_QUARTER = GRID_COLS * GRID_ROWS;  // 40
const STICKERS_PER_SHEET = STICKERS_PER_QUARTER * 4;  // 160

// Binnen elk kwartier:
// - Header: "0001-0040" (klein, lichtgrijs)
// - Grid: 5 kolommen × 8 rijen = 40 stickers
// - Horizontale afstand tussen stickers: 0mm (stickers tegen elkaar)
// - Snijlijnen: dashed 0.25mm grijs tussen alle stickers
//
// Elk sticker bevat:
// - Nummer in JetBrains Mono Bold 11pt, zwart, gecentreerd
// - 4-cijferig zero-padded: 0001, 0042, 0160

export function generateStickerSheet(startNumber: number): PDFDocument {
  // Implementatie met @react-pdf/renderer
  // Returns PDF binary
}
```

### Printtips

- **Papier:** stickerpapier A4 (Avery L7651, L7656 of soortgelijk, of universeel)
- **Print-instelling:** "Werkelijk formaat" (geen schaling), hoogste kwaliteit
- **Kleur:** zwart-wit
- Na printen uitknippen met een snijmachine of schaar

---

## 11. Kosten (flink lager)

| Service | Plan | Kosten/maand |
|---------|------|-------------|
| Supabase | Free tier | €0 |
| Vercel | Hobby | €0 |
| **Claude (via Desktop/Code)** | Bestaande Claude Pro/Max | Al betaald |
| Cardmarket / eBay / Tweakers API | Gratis | €0 |
| **Totaal nieuwe kosten** | | **€0** |

De app genereert geen Claude API-kosten meer omdat Claude Desktop/Code wordt gebruikt die je al hebt.

---

## 12. Implementatieroadmap

### 🏁 Fase 1 — Foundation (~2 dagen)

```
[ ] Supabase project via MCP
[ ] Schema uitrollen (sectie 4)
[ ] Storage buckets: product-photos, bulk-uploads, taxatie-pdfs, sticker-sheets
[ ] Monorepo met pnpm workspaces
[ ] apps/web: Next.js + shadcn/ui + Supabase SSR auth
[ ] apps/mobile: Expo + expo-router + Supabase auth
[ ] packages/shared: types + zod schemas
[ ] packages/mcp-server: skeleton

Verificatie: inloggen werkt op beide apps.
```

### 🏷️ Fase 2 — Sticker systeem (~2 dagen)

```
[ ] Edge Function generate-sticker-sheet
[ ] Web-pagina /stickers met PDF generator
[ ] ML Kit Text Recognition in Expo
[ ] Sticker-mode selector in CaptureScreen
[ ] Drie modi implementeren (OCR inline/separate/manual)
[ ] Database: sticker_sheets tabel gebruiken

Verificatie: PDF genereren → uitprinten → foto maken →
             sticker ID automatisch gekoppeld.
```

### 📸 Fase 3 — Indexeren (Fase A) (~3 dagen)

```
[ ] CaptureScreen mobiel met 5 modi
    (product/barcode/merkteken/detail/sticker)
[ ] Foto upload naar Storage
[ ] Bulk upload web met drag-drop
[ ] Inventory tabel mobiel + web
[ ] Product detail scherm
[ ] EAN barcode scanner

Verificatie: 50 items indexeren in 1 sessie.
```

### 🤖 Fase 4 — MCP Server (Fase B) (~3 dagen)

```
[ ] MCP server package opzetten
[ ] Tools: list_inventory, get_product_photos, search_products
[ ] Tools: suggest_bundle, create_listing, update_product
[ ] Lokale test met Claude Desktop
[ ] README met installatie-instructies

Verificatie: Claude Desktop kan foto's bekijken en bundles suggereren.
```

### 💰 Fase 5 — Lookup & Publicatie (~3 dagen)

```
[ ] Edge Function lookup-ean
[ ] Edge Function fetch-prices (Marktplaats/Tweakers/Cardmarket/eBay)
[ ] Edge Function fetch-buyback-quotes
[ ] Edge Function identify-card-by-id
[ ] Edge Function lookup-silver-hallmark + lookup-tin-mark
[ ] Edge Function publish-listing
[ ] Listing goedkeuringsscherm mobiel + web

Verificatie: product via Claude → listing draft → goedkeuren → live op platform.
```

### 🏛️ Fase 6 — Antiek & Taxatie (~2 dagen)

```
[ ] Merkteken macro-camera modus met tips
[ ] Edge Function generate-taxatie-pdf
[ ] Taxatie workflow op web
[ ] PDF preview + email

Verificatie: tinnen kan → merkteken foto → Claude leest tekst →
             TinVereniging lookup → PDF klaar voor taxateur.
```

### 🎨 Fase 7 — Afwerking (~2 dagen)

```
[ ] Statistieken dashboard (recharts)
[ ] Database browser
[ ] Prijswatchers met pg_cron
[ ] Push notificaties
[ ] Offline support mobiel
[ ] Backups

Verificatie: alles werkt end-to-end.
```

---

## 13. Startcommando's voor Claude Code

### Helemaal nieuw starten

```
Ik wil de verkoopassistent app bouwen zoals beschreven in PLAN.md.
Start met Fase 1 (Foundation):
1. Maak de monorepo structuur aan (apps/web, apps/mobile,
   packages/shared, packages/mcp-server, supabase)
2. Gebruik de Supabase MCP om een nieuw project aan te maken
3. Rol het volledige database schema uit uit sectie 4
4. Verifieer dat alle tabellen en enums zijn aangemaakt

Rapporteer wat je hebt gedaan.
```

### Stickersysteem bouwen

```
Implementeer Fase 2 (Sticker systeem) uit PLAN.md.
Begin met de generate-sticker-sheet Edge Function.
Gebruik @react-pdf/renderer voor de PDF generatie.
Volg de specificatie in sectie 10 exact (21×15mm stickers,
4 kwartieren, 5×8 grid per kwartier, JetBrains Mono Bold).
Test door PDF te genereren met startNumber=1 en deze te
openen om te controleren of de lay-out klopt.
```

### MCP server bouwen

```
Implementeer Fase 4 (MCP Server) uit PLAN.md.
Maak packages/mcp-server met alle 6 tools uit sectie 6.
Gebruik @modelcontextprotocol/sdk voor de server.
Zorg dat get_product_photos signed URLs returnt van Supabase
Storage die 1 uur geldig zijn.
Voeg een README toe met stap-voor-stap installatie in
claude_desktop_config.json.
```

---

## 14. Belangrijke Ontwerpbeslissingen

| Beslissing | Waarom |
|-----------|--------|
| 2-fasen flow (indexeren dan verkopen) | Realistische workflow — je hebt niet ineens alles klaar |
| Geen Claude Vision API | Claude Desktop/Code kan foto's al bekijken, bespaart kosten |
| MCP server als analyse-interface | Geeft Claude gestructureerde database-toegang |
| Sticker-ID systeem | Fysieke ↔ digitale koppeling, voorkomt fouten |
| ML Kit OCR on-device | Geen internet nodig, privacy-vriendelijk, gratis |
| 3 sticker-modi | Flexibiliteit: snel (OCR) of zeker (aparte foto) of offline (manual) |
| 160 stickers per A4 | Goede balans tussen formaat en aantal |
| 4-cijferig zero-padded | Tot 9999 items, consistente sortering |
| JetBrains Mono voor sticker-font | Uitstekende OCR-herkenning van cijfers |

---

*Einde PLAN.md. Versie 2.0 — Sticker-systeem + Claude Desktop/Code workflow.*
