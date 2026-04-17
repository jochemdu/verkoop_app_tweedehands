import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getSupabase } from "../lib/supabase.js";
import { jsonContent, errorContent } from "../lib/format.js";

const schema = z.object({
  mark_text: z
    .string()
    .min(1)
    .max(200)
    .describe(
      "De tekst die je van het tinmerk afleest, bijv. 'ANNO 1762 D.B.', 'engel', 'rozenkroontje + JD', etc.",
    ),
  hints: z
    .object({
      year: z.string().optional(),
      region: z.string().optional(),
    })
    .optional()
    .describe("Optionele context uit de foto (geschat jaar, regio)."),
});

export const lookupTinMarkDefinition = {
  name: "lookup_tin_mark",
  description:
    "Zoek een tinmerk op in Nederlandse databases (TinVereniging + Zilver.nl) en haal context over het NL tinmerken-systeem op (engel/rozenkroontje merken, stad/jaar/maker-indicators). Gebruik na visuele inspectie van macro-foto. Returnt candidates + extra zoek-URLs.",
  inputSchema: zodToJsonSchema(schema, { target: "openApi3" }),
};

export async function handleLookupTinMark(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("lookup-tin-mark", {
    body: parsed.data,
  });
  if (error) return errorContent(`Edge Function fout: ${error.message}`);
  return jsonContent(data, `Tinmerk lookup voor "${parsed.data.mark_text}":`);
}
