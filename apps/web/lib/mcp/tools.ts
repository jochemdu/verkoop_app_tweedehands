import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Database,
  resolveProductId,
  signedPhotoUrls,
  sanitizeForLLM,
  sanitizeIlikeQuery,
} from "@verkoopassistent/shared";

// Gehoste MCP-tools (fase 34). Elke handler krijgt een user-gescopte Supabase
// client (RLS = isolatie), dus geen expliciete user_id-filters nodig. Een
// gecureerde set gericht op de kernwens: inventaris uitlezen, verkoopteksten
// schrijven en marktonderzoek vastleggen.

type Client = SupabaseClient<Database>;

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function err(message: string): ToolResult {
  return { content: [{ type: "text", text: `Fout: ${message}` }], isError: true };
}

type Tool = {
  name: string;
  description: string;
  schema: z.ZodType;
  handler: (db: Client, args: unknown) => Promise<ToolResult>;
};

const TOOLS: Tool[] = [
  {
    name: "list_inventory",
    description:
      "Lijst de recentste producten uit je inventaris (titel, sticker, categorie, status). Optioneel filteren op status of categorie.",
    schema: z.object({
      status: z.string().optional(),
      category_slug: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }),
    handler: async (db, args) => {
      const a = args as { status?: string; category_slug?: string; limit: number };
      let q = db
        .from("products")
        .select("id, sticker_id, working_title, title, category_slug, status, recommended_price, indexed_at")
        .is("deleted_at", null)
        .order("indexed_at", { ascending: false })
        .limit(a.limit);
      if (a.status)
        q = q.eq("status", a.status as Database["public"]["Enums"]["product_status"]);
      if (a.category_slug) q = q.eq("category_slug", a.category_slug);
      const { data, error } = await q;
      if (error) return err(error.message);
      return ok({ count: data?.length ?? 0, products: data ?? [] });
    },
  },
  {
    name: "search_products",
    description:
      "Zoek in je inventaris op titel/werktitel/notities. Geeft matchende producten terug.",
    schema: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    handler: async (db, args) => {
      const a = args as { query: string; limit: number };
      const term = sanitizeIlikeQuery(a.query);
      if (!term) return ok({ count: 0, products: [] });
      const { data, error } = await db
        .from("products")
        .select("id, sticker_id, working_title, title, category_slug, status")
        .is("deleted_at", null)
        .or(
          `working_title.ilike.%${term}%,title.ilike.%${term}%,indexing_notes.ilike.%${term}%`,
        )
        .limit(a.limit);
      if (error) return err(error.message);
      return ok({ count: data?.length ?? 0, products: data ?? [] });
    },
  },
  {
    name: "get_product_context",
    description:
      "Alles over één product in één call: velden + specs + foto-URLs + advertenties + eerder marktonderzoek. Startpunt voor een verkooptekst of marktonderzoek.",
    schema: z.object({
      product: z.string().describe("UUID of 4-cijferig sticker-ID."),
    }),
    handler: async (db, args) => {
      const a = args as { product: string };
      let productId: string;
      try {
        productId = await resolveProductId(db, a.product);
      } catch (e) {
        return err(e instanceof Error ? e.message : "Product niet gevonden");
      }
      const { data: product, error } = await db
        .from("products")
        .select(
          "id, sticker_id, working_title, title, description, category_slug, condition, status, specs, defects, ean, estimated_value_min, estimated_value_max, recommended_price, indexing_notes, photo_advice",
        )
        .eq("id", productId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) return err(error.message);
      if (!product) return err("Product niet gevonden.");

      const [{ data: listings }, { data: comparables }, photos] = await Promise.all([
        db.from("listings").select("id, status, price, final_title, final_description, listing_url").eq("product_id", productId),
        db.from("market_comparables").select("source, url, title, price, is_sold, condition, brand, model, color, notes").eq("product_id", productId).order("created_at", { ascending: false }).limit(25),
        signedPhotoUrls(db, productId, { expiresIn: 3600, limit: 8 }).catch(() => []),
      ]);
      return ok({
        product,
        photos,
        listings: listings ?? [],
        market_comparables: comparables ?? [],
      });
    },
  },
  {
    name: "get_product_photos",
    description: "Signed foto-URLs (1 uur geldig) van één product.",
    schema: z.object({ product: z.string() }),
    handler: async (db, args) => {
      const a = args as { product: string };
      let productId: string;
      try {
        productId = await resolveProductId(db, a.product);
      } catch (e) {
        return err(e instanceof Error ? e.message : "Product niet gevonden");
      }
      const photos = await signedPhotoUrls(db, productId, { expiresIn: 3600 });
      return ok({ product_id: productId, photos });
    },
  },
  {
    name: "update_product",
    description:
      "Werk verkoop-velden van een product bij: titel, beschrijving, conditie, status, adviesprijs.",
    schema: z.object({
      product: z.string(),
      title: z.string().max(200).optional(),
      description: z.string().max(5000).optional(),
      condition: z
        .enum(["mint", "near_mint", "excellent", "very_good", "good", "fair", "poor"])
        .optional(),
      status: z.string().optional(),
      recommended_price: z.number().nonnegative().optional(),
    }),
    handler: async (db, args) => {
      const a = args as Record<string, unknown>;
      let productId: string;
      try {
        productId = await resolveProductId(db, a.product as string);
      } catch (e) {
        return err(e instanceof Error ? e.message : "Product niet gevonden");
      }
      const patch: Database["public"]["Tables"]["products"]["Update"] = {};
      if (a.title !== undefined) patch.title = a.title as string;
      if (a.description !== undefined) patch.description = a.description as string;
      if (a.condition !== undefined)
        patch.condition = a.condition as Database["public"]["Enums"]["product_condition"];
      if (a.status !== undefined)
        patch.status = a.status as Database["public"]["Enums"]["product_status"];
      if (a.recommended_price !== undefined)
        patch.recommended_price = a.recommended_price as number;
      if (Object.keys(patch).length === 0) return err("Niets om bij te werken.");
      const { data, error } = await db
        .from("products")
        .update(patch)
        .eq("id", productId)
        .is("deleted_at", null)
        .select("id, title, status, recommended_price")
        .maybeSingle();
      if (error) return err(error.message);
      if (!data) return err("Product niet gevonden.");
      return ok({ updated: data });
    },
  },
  {
    name: "save_market_research",
    description:
      "Sla vergelijkbare advertenties op bij een product (marktonderzoek): bron, prijs, staat, model, kleur, tekstfragmenten. Zoek deze zelf op het web op.",
    schema: z.object({
      product: z.string(),
      comparables: z
        .array(
          z.object({
            source: z.string().max(50),
            url: z.string().url().max(500).optional(),
            title: z.string().min(2).max(200),
            price: z.number().nonnegative().optional(),
            is_sold: z.boolean().optional(),
            condition: z.string().max(100).optional(),
            brand: z.string().max(100).optional(),
            model: z.string().max(100).optional(),
            color: z.string().max(50).optional(),
            notes: z.string().max(500).optional(),
          }),
        )
        .min(1)
        .max(30),
    }),
    handler: async (db, args) => {
      const a = args as {
        product: string;
        comparables: Array<Record<string, unknown>>;
      };
      let productId: string;
      try {
        productId = await resolveProductId(db, a.product);
      } catch (e) {
        return err(e instanceof Error ? e.message : "Product niet gevonden");
      }
      const rows = a.comparables.map((c) => ({
        product_id: productId,
        source: sanitizeForLLM(String(c.source)),
        url: (c.url as string) ?? null,
        title: sanitizeForLLM(String(c.title)),
        price: (c.price as number) ?? null,
        is_sold: (c.is_sold as boolean) ?? null,
        condition: c.condition ? sanitizeForLLM(String(c.condition)) : null,
        brand: (c.brand as string) ?? null,
        model: (c.model as string) ?? null,
        color: (c.color as string) ?? null,
        notes: c.notes ? sanitizeForLLM(String(c.notes)) : null,
      }));
      // user_id via DEFAULT auth.uid() (user-gescopte client) — RLS check slaagt.
      const { error } = await db.from("market_comparables").insert(rows);
      if (error) return err(error.message);
      return ok({ saved: rows.length });
    },
  },
];

export function toolDefinitions() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: z.toJSONSchema(t.schema),
  }));
}

export async function callTool(
  db: Client,
  name: string,
  rawArgs: unknown,
): Promise<ToolResult> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return err(`Onbekende tool: ${name}`);
  const parsed = tool.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return err(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  try {
    return await tool.handler(db, parsed.data);
  } catch (e) {
    return err(e instanceof Error ? e.message : "onbekende fout");
  }
}
