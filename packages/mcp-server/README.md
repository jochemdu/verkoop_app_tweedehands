# @verkoopassistent/mcp-server

MCP (Model Context Protocol) server die Claude Desktop/Code toegang geeft tot je VerkoopAssistent inventaris. Via deze server kan Claude producten opzoeken, foto's tonen, bundels voorstellen, en advertenties aanmaken — allemaal vanuit een gesprek.

## Tools

| Tool | Wat doet het |
|------|--------------|
| `ping` | Test de verbinding en returnt het totaal aantal producten. |
| `list_inventory` | Lijst producten met filters (status, categorie, sticker-range). |
| `get_product_photos` | Haal signed URLs op van alle foto's van 1 product (1u geldig default). |
| `search_products` | Full-text zoek op titel/omschrijving/notities. |
| `suggest_bundle` | Maak een concept-bundel aan met meerdere producten + reasoning. |
| `create_listing` | Maak een concept-advertentie voor een product + platform. |
| `update_product` | Werk productgegevens bij (categoriseer, conditie, specs, etc.). |

Elke tool accepteert zowel UUID's als 4-cijferige sticker-ID's (bijv. `"0042"`) als product-identifier waar relevant.

## Architectuur: twee MCP-surfaces (bewuste keuze)

Er zijn twee MCP-servers, en sommige tools delen een naam (`list_inventory`,
`search_products`, `get_product_context`, `get_product_photos`,
`update_product`, `save_market_research`). Dat is **geen duplicatie om weg te
werken** — het zijn twee verschillende surfaces met een verschillend
auth-model en een verschillende scope:

| | Deze lokale stdio-server (`packages/mcp-server`) | Gehoste server (`apps/web/lib/mcp`) |
|---|---|---|
| **Voor** | Claude Desktop/Code, lokaal voor jezelf | claude.ai (custom connector), multi-tenant |
| **Auth** | **service-role** (godmode) + expliciete `getOwnerId()` / `getOwnerWorkspaceId()` | per-gebruiker JWT → **RLS** doet de isolatie (geen user-filter in code) |
| **Scope** | volledige toolkit (18 tools), rijker (bv. prijsadvies, extra logging) | gecureerde, veilige subset (6 tools) |

Omdat service-role RLS omzeilt, **moet** de lokale server elke query expliciet
op de owner scopen; de gehoste server leunt juist op RLS. Daarom verschillen de
handlers (en soms de schema's) bewust. De tools klakkeloos samenvoegen zou óf de
rijkere lokale features slopen, óf owner/service-role-complexiteit (en
cross-tenant-risico) de gehoste kant in duwen.

De écht gedeelde logica is wél al gededupliceerd en leeft in
`packages/shared`: `resolveProductId` / `resolveProductIds`, `signedPhotoUrls`,
`sanitizeForLLM` / `sanitizeIlikeQuery`, de zod-schemas en de DB-types. Beide
servers zijn dunne surfaces bovenop die gedeelde kern. Wil je de auth-modellen
ooit unificeren (zodat ook de handlers gedeeld worden), dan is de weg: de lokale
server een owner-gescopte **RLS**-client geven (owner-JWT minten, zoals de web
doet) i.p.v. service-role — een aparte, bewuste stap.

## Prerequisites

- Node.js 20+
- Service role key uit je Supabase project  
  → Dashboard → Project Settings → API → `service_role` (klik op *Reveal*)
- `pnpm install` op monorepo root uitgevoerd

## Installatie in Claude Desktop

Bewerk `%APPDATA%\Claude\claude_desktop_config.json` (Windows) of `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "verkoopassistent": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "D:\\AntiGravity_Projects\\Verkoop_index_app\\packages\\mcp-server\\src\\index.ts"
      ],
      "env": {
        "SUPABASE_URL": "https://ffifhjwjauvhohmhhbip.supabase.co",
        "SUPABASE_SERVICE_KEY": "eyJhbGciOi..."
      }
    }
  }
}
```

Herstart Claude Desktop. Typ in een nieuw gesprek `/mcp` om de tool-lijst te zien, of vraag direct: *"Roep de ping-tool aan"*.

## Installatie in Claude Code

```bash
claude mcp add verkoopassistent \
  --env SUPABASE_URL="https://ffifhjwjauvhohmhhbip.supabase.co" \
  --env SUPABASE_SERVICE_KEY="eyJhbGciOi..." \
  -- npx -y tsx "D:/AntiGravity_Projects/Verkoop_index_app/packages/mcp-server/src/index.ts"
```

Check met `/mcp`.

## Lokaal testen

```bash
# .env kopiëren en invullen
cp packages/mcp-server/.env.example packages/mcp-server/.env
# edit .env, plak echte SUPABASE_SERVICE_KEY

# Direct starten
pnpm -F @verkoopassistent/mcp-server start

# Of met MCP Inspector UI (handmatig tools aanroepen):
pnpm -F @verkoopassistent/mcp-server inspector
# → opent http://localhost:6274 in je browser
```

## Typische workflow met Claude Desktop

```
JIJ:    Laat me de inventaris zien van sticker 0042 t/m 0060

CLAUDE: [list_inventory met sticker_range_start=0042, sticker_range_end=0060]
        Ik zie 19 producten. 12 zijn al gecategoriseerd (7× RAM,
        3× Pokémon kaarten, 2× consoles), 7 staan als 'unknown'.
        Wil je dat ik de foto's van de unknowns bekijk?

JIJ:    Ja graag

CLAUDE: [get_product_photos voor elk unknown product]
        [deelt de signed URLs — jij ziet de foto's in het gesprek]
        Op basis van de foto's:
        - 0045: antieke tinnen kandelaar met merkteken D.B. 1762
        - 0048: DDR2 SODIMM 2GB Samsung
        - 0052: PlayStation 2 controller (Dual Shock)
        ...
        Zal ik deze categoriseren?

JIJ:    Ja, en stel een bundel voor met alle compatibele RAM

CLAUDE: [update_product ×3 voor de RAM modules met category + specs]
        [list_inventory met category=ram_sodimm]
        [analyseert specs — zelfde generatie + speed]
        [suggest_bundle]
        Bundle aangemaakt:
        "DDR2 SODIMM 8GB Kit (4×2GB Samsung)"
        Stickers: 0048, 0051, 0058, 0061
        Voorgestelde prijs: €45 (matched-kit premium)
```

## Security

- De MCP server gebruikt de **service role key** en heeft dus volledige DB-toegang (bypass RLS).
- Draai de server daarom **alleen lokaal** — nooit exposen aan het internet.
- De `env` in `claude_desktop_config.json` is lokaal op jouw machine; deel dat bestand niet.

## Architectuur

```
src/
├── index.ts          # Server bootstrap, tool-dispatcher, ping tool
├── lib/
│   ├── supabase.ts   # Singleton service-role client
│   ├── resolve.ts    # UUID ↔ sticker_id resolver
│   └── format.ts     # Response formatters (text/JSON)
└── tools/            # Eén bestand per tool
    ├── list_inventory.ts
    ├── get_product_photos.ts
    ├── search_products.ts
    ├── suggest_bundle.ts
    ├── create_listing.ts
    └── update_product.ts
```

Elke tool exporteert een `definition` (MCP tool descriptor) en een `handler` (async function). `index.ts` aggregeert ze en dispatcht op naam.

## Volgende stappen (Fase 5+)

- Integreer prijs-lookup tools: `fetch_marktplaats_prices`, `lookup_ean`, `identify_card_by_id`
- Publicatie-tool: `publish_listing` → actueel plaatsen via platform API
- Batch bulk-update voor snelle categorisatie van veel unknowns
