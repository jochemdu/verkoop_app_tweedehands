#!/usr/bin/env tsx
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getSupabase } from "./lib/supabase";
import { errorContent } from "./lib/format";
import {
  listInventoryDefinition,
  handleListInventory,
} from "./tools/list_inventory";
import {
  getProductPhotosDefinition,
  handleGetProductPhotos,
} from "./tools/get_product_photos";
import {
  searchProductsDefinition,
  handleSearchProducts,
} from "./tools/search_products";
import {
  suggestBundleDefinition,
  handleSuggestBundle,
} from "./tools/suggest_bundle";
import {
  createListingDefinition,
  handleCreateListing,
} from "./tools/create_listing";
import {
  updateProductDefinition,
  handleUpdateProduct,
} from "./tools/update_product";
import { lookupEanDefinition, handleLookupEan } from "./tools/lookup_ean.js";
import {
  fetchTweakersPricesDefinition,
  handleFetchTweakersPrices,
} from "./tools/fetch_tweakers_prices.js";
import {
  markListingPublishedDefinition,
  handleMarkListingPublished,
} from "./tools/mark_listing_published.js";
import {
  createTaxatiePdfDefinition,
  handleCreateTaxatiePdf,
} from "./tools/create_taxatie_pdf.js";

// Ping tool — handig om de verbinding te checken zonder dat er data hoeft te zijn.
const pingDefinition = {
  name: "ping",
  description:
    "Test of de MCP server draait en de Supabase-verbinding werkt. Returnt het aantal producten in de inventaris.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

const TOOLS = [
  { def: pingDefinition, handler: handlePing },
  { def: listInventoryDefinition, handler: handleListInventory },
  { def: getProductPhotosDefinition, handler: handleGetProductPhotos },
  { def: searchProductsDefinition, handler: handleSearchProducts },
  { def: suggestBundleDefinition, handler: handleSuggestBundle },
  { def: createListingDefinition, handler: handleCreateListing },
  { def: updateProductDefinition, handler: handleUpdateProduct },
  { def: lookupEanDefinition, handler: handleLookupEan },
  { def: fetchTweakersPricesDefinition, handler: handleFetchTweakersPrices },
  { def: markListingPublishedDefinition, handler: handleMarkListingPublished },
  { def: createTaxatiePdfDefinition, handler: handleCreateTaxatiePdf },
];

async function handlePing() {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });
  if (error) return errorContent(`Supabase error: ${error.message}`);
  return {
    content: [
      {
        type: "text" as const,
        text: `pong — MCP server verbonden met Supabase. ${count ?? 0} producten in inventaris.`,
      },
    ],
  };
}

const server = new Server(
  {
    name: "verkoopassistent",
    version: "0.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => t.def),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = TOOLS.find((t) => t.def.name === request.params.name);
  if (!tool) {
    return errorContent(`Onbekende tool: ${request.params.name}`);
  }
  try {
    return await tool.handler(request.params.arguments ?? {});
  } catch (err) {
    return errorContent(err instanceof Error ? err.message : String(err));
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[verkoopassistent-mcp] actief op stdio — ${TOOLS.length} tools geregistreerd`,
  );
}

main().catch((err) => {
  console.error("[verkoopassistent-mcp] fatal:", err);
  process.exit(1);
});
