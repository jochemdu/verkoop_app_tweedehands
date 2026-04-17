import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getSupabase } from "../lib/supabase.js";
import { jsonContent, errorContent } from "../lib/format.js";

const schema = z.object({
  mark_text: z
    .string()
    .min(1)
    .max(100)
    .describe(
      "De tekst die je van het merkteken afleest, bijv. '925', 'leeuw', 'JvD Amsterdam', of de volledige combinatie.",
    ),
  country_hint: z
    .enum(["NL", "UK", "DE", "FR", "other"])
    .optional()
    .describe("Vermoedelijke herkomst; default NL."),
});

export const lookupSilverHallmarkDefinition = {
  name: "lookup_silver_hallmark",
  description:
    "Zoek een zilverkeurmerk op in Nederlandse databases (Zilver.nl) en haal context over het NL zilvermerken-systeem op (gehaltemerken, kantoormerken, leeuw-keurmerk). Bedoeld voor gebruik nadat je een macro-foto van het merk hebt bekeken en de tekst hebt gelezen. Returnt candidates + extra zoek-URLs voor handmatige verificatie.",
  inputSchema: zodToJsonSchema(schema, { target: "openApi3" }),
};

export async function handleLookupSilverHallmark(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke(
    "lookup-silver-hallmark",
    { body: parsed.data },
  );
  if (error) return errorContent(`Edge Function fout: ${error.message}`);
  return jsonContent(data, `Zilvermerk lookup voor "${parsed.data.mark_text}":`);
}
