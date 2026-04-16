# @verkoopassistent/mcp-server

Skeleton MCP server — Fase 4 vult de echte tools (list_inventory, get_product_photos, suggest_bundle, create_listing, update_product, search_products) in.

## Fase 1: ping tool

Deze fase heeft alleen een `ping` tool ter verificatie dat de server start en een Supabase-verbinding kan maken.

## Lokaal testen

```bash
# Vanaf monorepo root:
pnpm -F @verkoopassistent/mcp-server start

# Of met de MCP inspector (UI voor handmatige tool-calls):
pnpm -F @verkoopassistent/mcp-server inspector
```

Verwachte env vars:

- `SUPABASE_URL` — bijv. `https://ffifhjwjauvhohmhhbip.supabase.co`
- `SUPABASE_SERVICE_KEY` — service role key (dashboard → Project Settings → API → `service_role` key)

Tip: plaats deze in `packages/mcp-server/.env` (zelfde formaat als root `.env.example`).

## Installeren in Claude Desktop (Fase 4+)

Voeg toe aan `%APPDATA%\Claude\claude_desktop_config.json` (Windows) of `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "verkoopassistent": {
      "command": "npx",
      "args": [
        "tsx",
        "<ABSOLUTE_PATH>/packages/mcp-server/src/index.ts"
      ],
      "env": {
        "SUPABASE_URL": "https://ffifhjwjauvhohmhhbip.supabase.co",
        "SUPABASE_SERVICE_KEY": "<service_role_key>"
      }
    }
  }
}
```

Herstart Claude Desktop → nieuw gesprek → tik `/mcp` om de verbinding te verifiëren.

## Volgende stappen

Fase 4 voegt toe: `list_inventory`, `get_product_photos`, `search_products`, `suggest_bundle`, `create_listing`, `update_product`. Zie PLAN (1).md sectie 6.
