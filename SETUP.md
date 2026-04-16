# VerkoopAssistent — Setup Guide (Fase 1)

Deze gids vult de foundation aan. De code is gescaffold en de Supabase DB staat — je hoeft alleen nog de redirect URLs in te stellen en lokaal te draaien.

## Supabase project

- **Project:** `verkoopassistent`
- **Project ID:** `ffifhjwjauvhohmhhbip`
- **URL:** `https://ffifhjwjauvhohmhhbip.supabase.co`
- **Region:** eu-central-1
- **Dashboard:** <https://supabase.com/dashboard/project/ffifhjwjauvhohmhhbip>

Env-waarden staan al in `apps/web/.env.local` en `apps/mobile/.env` (beide gitignored).

## Vereiste handmatige stap — Redirect URLs toevoegen

Supabase beperkt welke URLs magic links mogen openen. Voeg ze toe via het dashboard:

1. Ga naar <https://supabase.com/dashboard/project/ffifhjwjauvhohmhhbip/auth/url-configuration>
2. Onder **Site URL**: `http://localhost:3000`
3. Onder **Redirect URLs** (klik *Add URL* per stuk):
   - `http://localhost:3000/auth/callback`
   - `verkoopassistent://auth/callback`
   - `exp://**` (voor Expo Go tijdens development — gebruik de wildcard)

Bewaar.

## Lokaal draaien

```bash
# Eénmalig:
pnpm install

# Web dev server (magic link login werkt):
pnpm dev:web
# → http://localhost:3000

# Mobile (Expo Go, simulator, of device):
pnpm dev:mobile
# → scan QR code met Expo Go app

# MCP server (skeleton met ping tool):
pnpm -F @verkoopassistent/mcp-server start
```

## Verificatie

### Web
1. `pnpm dev:web`
2. Open `http://localhost:3000` → redirect naar `/login`
3. Voer je e-mail in → klik "Stuur magic link"
4. Check inbox → klik op link
5. Je komt op `/` en ziet "Ingelogd als …"

### Mobile (Expo Go)
1. `pnpm dev:mobile`
2. Scan QR met Expo Go app
3. App opent op login scherm
4. Voer e-mail in → klik "Stuur magic link"
5. Check inbox op je telefoon → tik op link
6. App opent automatisch, je bent ingelogd

### MCP server
```bash
pnpm -F @verkoopassistent/mcp-server inspector
```
Opent de MCP Inspector UI. Roep `ping` tool aan → moet `pong — verbonden met Supabase. platforms rijen: 7` returneren.

## Project structuur

```
.
├── PLAN.md / PLAN (1).md       # spec (v2 is leidend)
├── package.json                 # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── supabase/
│   ├── config.toml
│   └── migrations/0001_initial_schema.sql
├── packages/
│   ├── shared/                 # types + zod schemas
│   └── mcp-server/             # MCP skeleton (Fase 4 vult in)
└── apps/
    ├── web/                    # Next.js 14 + Supabase SSR
    └── mobile/                 # Expo SDK 52 + expo-router
```

## Volgende fase

**Fase 2 — Sticker systeem** (PLAN (1).md sectie 3 en 10):
- Edge Function `generate-sticker-sheet` met `@react-pdf/renderer`
- Web pagina `/stickers` met PDF generator
- ML Kit OCR in Expo
- 3 sticker-modi in capture screen
