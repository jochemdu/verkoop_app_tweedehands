import { z } from "zod";
import { CATEGORY_SLUGS, sanitizeForLLM } from "@verkoopassistent/shared";
import { getSupabase } from "../lib/supabase.js";
import { jsonContent, errorContent } from "../lib/format.js";
import { getOwnerId, getOwnerWorkspaceId } from "../lib/owner.js";

const schema = z.object({
  working_title: z
    .string()
    .min(2)
    .max(200)
    .describe("Korte omschrijving van het gespot item (bijv. 'houten kledingkast woonkamer links')."),
  category_slug: z.enum(CATEGORY_SLUGS).default("unknown"),
  indexing_notes: z
    .string()
    .max(1000)
    .optional()
    .describe("Context uit de foto: locatie, staat, kleuren, etc."),
  location_hint: z
    .string()
    .max(200)
    .optional()
    .describe("Waar in het huis het item zich bevindt (voor latere fysieke locatie)."),
  confirm: z
    .boolean()
    .default(false)
    .describe("Security: vereist confirm=true. Zonder confirm: dry-run response."),
});

export const createProductStubDefinition = {
  name: "create_product_stub",
  description:
    "Maak een placeholder product aan zonder sticker_id of foto's (Feat 20 Room Audit). Status=indexed, working_title bevat beschrijving. De gebruiker kan later fysiek een sticker plakken en via de web-app foto's toevoegen. Gebruik één stub per item dat je in een kamer-foto spot maar niet in de inventaris staat.",
  inputSchema: z.toJSONSchema(schema),
};

export async function handleCreateProductStub(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return errorContent(`Ongeldige invoer: ${parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`);

  const { working_title, category_slug, indexing_notes, location_hint, confirm } = parsed.data;

  if (!confirm) {
    return jsonContent(
      {
        dry_run: true,
        would_create: {
          working_title: sanitizeForLLM(working_title),
          category_slug,
          indexing_notes: indexing_notes ? sanitizeForLLM(indexing_notes) : null,
          location_hint,
          status: "indexed",
          sticker_id: null,
        },
        action_required:
          "Vraag de gebruiker of dit stub-product correct is. Herhaal met confirm=true na akkoord.",
      },
      `DRY-RUN: stub nog niet aangemaakt.`,
    );
  }

  const supabase = getSupabase();
  const notesCombined = [
    indexing_notes,
    location_hint ? `[locatie] ${location_hint}` : null,
    "[stub] Aangemaakt via Claude room audit, nog fysiek te lokaliseren en sticker plakken.",
  ]
    .filter(Boolean)
    .join("\n");

  const ownerId = await getOwnerId();
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      working_title,
      category_slug,
      indexing_notes: notesCombined,
      status: "indexed",
      sticker_input_method: null,
      user_id: ownerId,
      workspace_id: await getOwnerWorkspaceId(),
    })
    .select()
    .single();
  if (error || !product) return errorContent(error?.message ?? "stub insert failed");

  return jsonContent(
    { product_id: product.id, sticker_id: null, status: product.status, working_title: product.working_title },
    `Stub aangemaakt. Fysiek sticker plakken en foto's toevoegen via web-app of mobile capture.`,
  );
}
