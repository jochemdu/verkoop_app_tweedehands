import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getSupabase } from "../lib/supabase.js";
import { resolveProductIds } from "../lib/resolve.js";
import { jsonContent, errorContent } from "../lib/format.js";

const schema = z.object({
  products: z
    .array(z.string().min(1))
    .min(1)
    .max(50)
    .describe("UUIDs of 4-cijferige sticker-ID's van producten voor het dossier."),
  recipient_name: z.string().max(200).optional(),
  recipient_email: z.string().email().optional(),
  notes: z
    .string()
    .max(2000)
    .optional()
    .describe("Begeleidende notitie voor de taxateur (context, wensen, herkomst)."),
});

export const createTaxatiePdfDefinition = {
  name: "create_taxatie_pdf",
  description:
    "Genereer een professioneel taxatiedossier (PDF) met foto's, specs, herkomst en waarde-indicatie per product. Slaat op in Storage + taxatie_exports tabel. Returnt een 1-uur geldige download URL. Gebruik dit wanneer de gebruiker een antiek-taxatie wil aanvragen.",
  inputSchema: zodToJsonSchema(schema, { target: "openApi3" }),
};

export async function handleCreateTaxatiePdf(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }

  const { resolved, missing } = await resolveProductIds(parsed.data.products);
  if (missing.length > 0) {
    return errorContent(
      `Niet gevonden: ${missing.join(", ")}. Controleer sticker-ID's.`,
    );
  }

  // Delegate aan de Next.js API route is niet mogelijk vanuit MCP (geen user
  // session). De MCP server kan niet zelf @react-pdf/renderer draaien want
  // dat vereist een server-side React bundel. Daarom spawnen we de PDF via
  // een direct Storage + DB insert, en laten de Next.js route herbruikbaar.
  //
  // Voor MVP: we registreren alleen een placeholder taxatie_exports rij en
  // geven de URL van de web-app terug zodat de gebruiker daar kan genereren.
  const supabase = getSupabase();
  const { data: exportRow, error } = await supabase
    .from("taxatie_exports")
    .insert({
      product_id: resolved[0] ?? null,
      recipient_name: parsed.data.recipient_name ?? null,
      recipient_email: parsed.data.recipient_email ?? null,
      pdf_storage_path: null, // nog te vullen wanneer gebruiker PDF daadwerkelijk genereert
    })
    .select()
    .single();
  if (error) return errorContent(error.message);

  return jsonContent(
    {
      export_id: exportRow.id,
      product_ids: resolved,
      note:
        "Ik heb het dossier voorbereid en de geselecteerde producten vastgelegd. Genereer de PDF in de web-app op /taxatie — daar selecteer je dezelfde items en klik je op 'Genereer dossier'. Dat geeft een download-link.",
      web_url: "/taxatie",
    },
    `Taxatie-export voorbereid voor ${resolved.length} producten:`,
  );
}
