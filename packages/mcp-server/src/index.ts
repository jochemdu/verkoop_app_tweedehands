#!/usr/bin/env tsx
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getSupabase } from "./lib/supabase";

const server = new Server(
  {
    name: "verkoopassistent",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "ping",
      description:
        "Test of de MCP server draait en de Supabase-verbinding werkt. Geeft rij-aantal van platforms tabel terug.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "ping") {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from("platforms")
      .select("*", { count: "exact", head: true });
    if (error) {
      return {
        content: [{ type: "text", text: `Supabase error: ${error.message}` }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `pong — verbonden met Supabase. platforms rijen: ${count ?? 0}.`,
        },
      ],
    };
  }
  throw new Error(`Onbekende tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[verkoopassistent-mcp] server actief op stdio");
}

main().catch((err) => {
  console.error("[verkoopassistent-mcp] fatal:", err);
  process.exit(1);
});
