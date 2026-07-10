import { z } from "zod";
import { getSupabase } from "../lib/supabase.js";
import { jsonContent, errorContent } from "../lib/format.js";

const schema = z.object({
  ean: z
    .string()
    .regex(/^\d{8,14}$/)
    .describe("EAN-8, UPC-A, EAN-13 of ITF-14 barcode (8-14 cijfers)."),
});

export const lookupEanDefinition = {
  name: "lookup_ean",
  description:
    "Zoek een EAN/UPC barcode op in de Open*Facts publieke databases (Food, Beauty, Products). Werkt goed voor consumentenproducten; voor hardware/games/cards komt meestal geen match.",
  inputSchema: z.toJSONSchema(schema),
};

export async function handleLookupEan(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("lookup-ean", {
    body: { ean: parsed.data.ean },
  });
  if (error) return errorContent(`Edge Function fout: ${error.message}`);
  return jsonContent(data, `EAN lookup voor ${parsed.data.ean}:`);
}
