import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getSupabase } from "../lib/supabase.js";
import { jsonContent, errorContent } from "../lib/format.js";

const schema = z.object({
  query: z
    .string()
    .min(2)
    .describe(
      "Zoekterm voor Tweakers V&A, bijv. 'DDR2 SODIMM 2GB Samsung' of 'PlayStation 2 console'.",
    ),
  limit: z.number().int().min(1).max(50).default(20),
});

export const fetchTweakersPricesDefinition = {
  name: "fetch_tweakers_prices",
  description:
    "Haal actuele Tweakers V&A zoekresultaten op voor een zoekterm. Returnt listings met titel/prijs/URL plus samenvattende stats (min/max/avg/sample). Gebruik dit om een prijsindicatie te krijgen voor tweedehands hardware.",
  inputSchema: zodToJsonSchema(schema, { target: "openApi3" }),
};

export async function handleFetchTweakersPrices(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke(
    "fetch-tweakers-prices",
    { body: parsed.data },
  );
  if (error) return errorContent(`Edge Function fout: ${error.message}`);
  return jsonContent(data, `Tweakers prijzen voor "${parsed.data.query}":`);
}
