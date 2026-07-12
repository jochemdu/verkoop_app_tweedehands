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
2. Onder **Site URL**: `http://localhost:3000` (of je productie-URL zodra live)
3. Onder **Redirect URLs** (klik *Add URL* per stuk):
   - `http://localhost:3000/auth/callback`
   - `https://verkoopassistent.vercel.app/auth/callback` (productie)
   - `https://*-jochem-duins-projects.vercel.app/auth/callback` (Vercel
     preview-deploys — de magic link gebruikt de request-origin, maar
     Supabase staat alleen origins uit deze allowlist toe)
   - `verkoopassistent://auth/callback`
   - `exp://**` (voor Expo Go tijdens development)

### 1a. E-mail via Resend (custom SMTP) + inlogcode

Supabase's ingebouwde maildienst is zwaar gelimiteerd (~2 mails/uur, alleen
voor development). Met een Resend-account:

1. **Resend**: verifieer je domein (Resend → Domains → *Add Domain*, zet de
   DNS-records). Zonder eigen domein kun je alleen naar je eigen
   Resend-accountadres mailen.
2. **Supabase** → [Project Settings → Auth → SMTP Settings](https://supabase.com/dashboard/project/ffifhjwjauvhohmhhbip/settings/auth)
   → *Enable Custom SMTP*:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend` (letterlijk)
   - **Password:** je Resend API key (`re_…`)
   - **Sender email:** `login@<jouw-geverifieerde-domein>` 
   - **Sender name:** `VerkoopAssistent`
3. **Rate limit ophogen**: [Auth → Rate Limits](https://supabase.com/dashboard/project/ffifhjwjauvhohmhhbip/auth/rate-limits)
   → *Emails sent per hour* naar bijv. `100` (kan pas ná custom SMTP).
4. **Inlogcode in de mail** (voor de "Log in met code"-optie op /login):
   [Auth → Emails → Magic Link-template](https://supabase.com/dashboard/project/ffifhjwjauvhohmhhbip/auth/templates)
   vervangen door:

   ```html
   <h2>Inloggen bij VerkoopAssistent</h2>
   <p><a href="{{ .ConfirmationURL }}">Klik hier om in te loggen</a></p>
   <p>Of vul deze code in op de inlogpagina:</p>
   <p style="font-size:28px;letter-spacing:6px;font-weight:bold">{{ .Token }}</p>
   <p>Link en code verlopen na 1 uur. Niet aangevraagd? Negeer deze mail.</p>
   ```

   De code-optie is handig bij Hotmail/Outlook: hun link-scanner (SafeLinks)
   kan de magic link vooraf openen waardoor die al verbruikt is — de code
   heeft daar geen last van.

### 1c. Google-login + tweede e-mail koppelen (fase 30)

Zo log je met zowel je magic-link-mail als je Google/Gmail in **hetzelfde**
account (dezelfde inventaris):

1. **Google OAuth-credentials aanmaken**
   - Ga naar <https://console.cloud.google.com/> → maak (of kies) een project.
   - *APIs & Services* → *OAuth consent screen*: kies **External**, vul een
     app-naam + je e-mail in, en voeg jezelf toe als *Test user* (dan hoef je
     de app niet te laten verifiëren zolang het om een paar mensen gaat).
   - *APIs & Services* → *Credentials* → *Create Credentials* → *OAuth client
     ID* → type **Web application**.
   - Onder **Authorized redirect URIs** exact deze toevoegen:
     `https://ffifhjwjauvhohmhhbip.supabase.co/auth/v1/callback`
   - Kopieer de **Client ID** en **Client secret**.
2. **In Supabase** → [Authentication → Providers → Google](https://supabase.com/dashboard/project/ffifhjwjauvhohmhhbip/auth/providers)
   → aanzetten, Client ID + secret plakken, opslaan.
3. **Manual linking aanzetten** → [Authentication → Sign In / Providers →
   *Manual linking*](https://supabase.com/dashboard/project/ffifhjwjauvhohmhhbip/auth/providers)
   inschakelen (nodig voor het koppelen van een tweede login aan een bestaand
   account).
4. **Koppelen**: log in met je bestaande e-mailadres → **Instellingen →
   Login-methodes → *Koppel Google-account*** → kies je Gmail. Vanaf dan logt
   *Log in met Google* je in hetzelfde account. (De eerste keer los inloggen
   met een nieuwe Gmail maakt juist een apart account — koppel dus altijd
   vanuit je bestaande account.)

### 1b. Multi-user / vrienden uitnodigen (fase 21)

De app is multi-tenant: elke gebruiker ziet alleen z'n eigen producten,
foto's, stickers en advertenties (RLS + per-user storage-mappen). Iedereen
die inlogt via magic link krijgt automatisch een account + profiel.

- **Open aanmelding** (default): stuur je vrienden gewoon de URL.
- **Alleen op uitnodiging**: Dashboard → Authentication → Sign In / Up →
  zet *Allow new users to sign up* uit, en nodig mensen uit via
  Authentication → Users → *Invite user*.

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
4. Apply migration: `supabase/migrations/20260416180000_price_watcher_cron.sql`  
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

> Volledige Android build- en distributiegids: zie [ANDROID.md](ANDROID.md).

## Mobile EAS Development Build (Fase 3b — camera + ML Kit)

De mobile `Indexeren`-tab gebruikt `expo-camera` + `@react-native-ml-kit/text-recognition`. Die native modules werken **niet in Expo Go** — je hebt een EAS Development Build nodig.

```bash
npm install -g eas-cli
cd apps/mobile
eas login                                              # gratis Expo account
eas init                                               # vult expo.extra.eas.projectId
eas build --profile development --platform android     # of --platform ios
```

Build duurt ~15-20 min op Expo servers. Install de .apk/.ipa op je toestel, dan:
```bash
pnpm dev:mobile    # start Metro → scan QR met dev-client app (niet Expo Go)
```

Features actief in dev build: 3 sticker-modi (OCR separate / OCR inline / manual), on-device ML Kit OCR, EAN barcode scanner, auto-increment sticker-ID.

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

19 tools geladen: `ping`, `list_inventory`, `get_product_photos`,
`search_products`, `suggest_bundle`, `create_listing`, `update_product`,
`lookup_ean`, `lookup_book`, `fetch_tweakers_prices`,
`mark_listing_published`, `create_taxatie_pdf`, `lookup_silver_hallmark`,
`lookup_tin_mark`, `inventory_summary`, `create_product_stub`,
`get_product_context`, `save_market_research`.

**Marktonderzoek-workflow (fase 29)** — vraag Claude Desktop bijv.
*"doe marktonderzoek voor sticker 0042 en schrijf een verkooptekst"*:
1. `get_product_context` — product + specs + foto's + eerder onderzoek in één call
2. Claude zoekt zelf op het web naar vergelijkbare (verkochte) advertenties
   op Marktplaats/Vinted/eBay — prijs, staat, model, kleur, formuleringen
3. `save_market_research` — alles gestructureerd opgeslagen in
   `market_comparables`, optioneel met prijsadvies direct op het product
4. `create_listing` — verkooptekst op basis van het onderzoek, klaar voor
   review op `/listings`

## Volledige workflow (end-to-end)

0. **Kamer-scan (optioneel)** — web `/suggestions` → upload kamerfoto's → AI
   benoemt verkoopbare items + checkt wat al geïndexeerd is → maak stubs
1. **Print stickers** — web `/stickers` → A4 PDF (3 formaten, optioneel QR) → plak op producten
2. **Indexeer** — mobile `Indexeren` tab (foto + sticker-ID) OF web `/upload` (bulk drag-drop)
3. **Analyseer (in-app)** — productpagina → "✨ Analyseer met AI", of selecteer
   meerdere producten in `/inventory` → "Analyseer (N)". Vereist
   `ANTHROPIC_API_KEY` in `apps/web/.env.local` (en op Vercel). Het model
   herkent het product, schrijft een NL advertentietekst, schat de prijs en
   zet een concept-advertentie klaar in `/listings`.
   *Alternatief:* Claude Desktop → `list_inventory` + `get_product_photos` +
   `lookup_ean` + `update_product` (MCP, voor bundels/prijsonderzoek)
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
├── PLAN.md                      # spec (v2 — sticker-systeem + MCP workflow)
├── SETUP.md                     # dit bestand
├── pnpm-workspace.yaml
├── supabase/
│   ├── migrations/                # gespiegeld aan remote history — zie migrations/README.md
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

## Nog niet geïmplementeerd

- **Push notificaties** — vereist Expo Push Tokens setup
- **Offline mode mobiel** — vereist local SQLite + sync-laag
- **Auto-publish naar Marktplaats/Tweakers** — vereist merchant API OAuth
- **Email verzending taxatiedossier** — vereist Resend/SendGrid account
- **Cardmarket API integratie** — vereist API key
