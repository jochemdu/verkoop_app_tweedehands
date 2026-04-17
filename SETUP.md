# VerkoopAssistent — Setup Guide

## Supabase project

- **Project:** `verkoopassistent`
- **Project ID:** `ffifhjwjauvhohmhhbip`
- **URL:** `https://ffifhjwjauvhohmhhbip.supabase.co`
- **Region:** eu-central-1
- **Dashboard:** <https://supabase.com/dashboard/project/ffifhjwjauvhohmhhbip>

Env-waarden staan al in `apps/web/.env.local` en `apps/mobile/.env` (beide gitignored).

## Eenmalige Supabase configuratie

### 1. Auth redirect URLs (voor magic link login)

1. Ga naar <https://supabase.com/dashboard/project/ffifhjwjauvhohmhhbip/auth/url-configuration>
2. Onder **Site URL**: `http://localhost:3000`
3. Onder **Redirect URLs** (klik *Add URL* per stuk):
   - `http://localhost:3000/auth/callback`
   - `verkoopassistent://auth/callback`
   - `exp://**` (voor Expo Go tijdens development)

### 2. Service role key (voor MCP server + price-watcher)

1. Ga naar <https://supabase.com/dashboard/project/ffifhjwjauvhohmhhbip/settings/api>
2. Onder **Project API keys** → klik *Reveal* naast `service_role`
3. Kopieer de key — je hebt hem nodig voor de MCP server config én voor Vault.

### 3. Vault secret voor price-watcher cron (Fase 7)

De price-watcher Edge Function wordt elk uur aangeroepen door pg_cron.
Het cron-commando haalt de service role key op uit Supabase Vault zodat
we hem niet in plain-text SQL hoeven te zetten.

1. Ga naar <https://supabase.com/dashboard/project/ffifhjwjauvhohmhhbip/integrations/vault/overview>
2. Klik *New secret* → name: `service_role_key` → value: <plak service role key>
3. Save.
4. Apply migration: `supabase/migrations/0003_price_watcher_cron.sql`  
   — kopieer en run in <https://supabase.com/dashboard/project/ffifhjwjauvhohmhhbip/sql/new>

Verifieer:
```sql
SELECT jobname, schedule, active FROM cron.job;
```

## Lokaal draaien

```bash
# Eénmalig:
pnpm install

# Web dev server (magic link login werkt):
pnpm dev:web              # → http://localhost:3000

# Mobile (Expo Go, simulator, of device):
pnpm dev:mobile           # → scan QR code met Expo Go app

# MCP server (lokaal testen):
pnpm -F @verkoopassistent/mcp-server start
```

## MCP Server installeren in Claude Desktop/Code

Zie [packages/mcp-server/README.md](packages/mcp-server/README.md) voor de
volledige config.

Kort (Claude Desktop, `%APPDATA%\Claude\claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "verkoopassistent": {
      "command": "npx",
      "args": ["-y", "tsx", "D:\\AntiGravity_Projects\\Verkoop_index_app\\packages\\mcp-server\\src\\index.ts"],
      "env": {
        "SUPABASE_URL": "https://ffifhjwjauvhohmhhbip.supabase.co",
        "SUPABASE_SERVICE_KEY": "<plak service role key>"
      }
    }
  }
}
```

11 tools worden geladen: `ping`, `list_inventory`, `get_product_photos`,
`search_products`, `suggest_bundle`, `create_listing`, `update_product`,
`lookup_ean`, `fetch_tweakers_prices`, `mark_listing_published`,
`create_taxatie_pdf`.

## Volledige workflow (end-to-end)

1. **Print stickers** — web `/stickers` → A4 PDF → plak op producten
2. **Indexeer** — mobile `Indexeren` tab (foto + sticker-ID) OF web `/upload` (bulk drag-drop)
3. **Analyseer** — Claude Desktop → `list_inventory` + `get_product_photos` + `lookup_ean` + `update_product`
4. **Bundel** — Claude → `suggest_bundle` met reasoning
5. **Prijsonderzoek** — Claude → `fetch_tweakers_prices`
6. **Listing draft** — Claude → `create_listing` (status=pending_review)
7. **Review + edit** — web `/listings/[id]` → approve
8. **Post** — manueel op Marktplaats/Tweakers, kopieer tekst uit de app
9. **Markeer gepubliceerd** — plak URL + klik knop → product wordt 'listed'
10. **Taxatie voor antiek** — web `/taxatie` → selecteer items → genereer PDF dossier
11. **Prijswatchers** — insert rijen in `price_watches`; cron tracked ze automatisch

## Project structuur

```
.
├── PLAN.md / PLAN (1).md       # spec (v2 is leidend)
├── SETUP.md                     # dit bestand
├── pnpm-workspace.yaml
├── supabase/
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql        # Fase 1
│   │   └── 0003_price_watcher_cron.sql    # Fase 7 (na Vault secret)
│   └── functions/              # Edge Functions (gedeployed via MCP)
│       ├── lookup-ean/
│       ├── fetch-tweakers-prices/
│       └── price-watcher/
├── packages/
│   ├── shared/                 # types + zod schemas
│   └── mcp-server/             # 11 tools voor Claude Desktop
└── apps/
    ├── web/                    # Next.js 15 + React 19 + Tailwind 4
    │   └── app/(app)/          # dashboard, inventory, listings, taxatie, upload, stickers
    └── mobile/                 # Expo SDK 53 + expo-router 5
        └── app/(tabs)/         # dashboard, capture, inventory, listings
```

## Nog niet geïmplementeerd (Fase 3b / 6b / 7b)

- **expo-camera met 5 custom modi + ML Kit OCR** — vereist EAS Development Build, gebruik voor nu expo-image-picker in de Indexeren-tab
- **Silver / tin hallmark lookup** — vereist TinVereniging/Zilver.nl scrapers (specialistisch)
- **Push notificaties** — vereist Expo Push Tokens setup
- **Offline mode mobiel** — vereist local SQLite + sync-laag
- **Auto-publish naar Marktplaats/Tweakers** — vereist merchant API OAuth
- **Email verzending taxatiedossier** — vereist Resend/SendGrid account
- **Cardmarket API integratie** — vereist API key
