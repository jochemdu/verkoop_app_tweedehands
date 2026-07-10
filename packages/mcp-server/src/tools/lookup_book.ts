import { z } from "zod";
import { lookupBook } from "@verkoopassistent/shared";
import { jsonContent, errorContent } from "../lib/format.js";

const schema = z.object({
  isbn: z
    .string()
    .min(9)
    .max(17)
    .describe("ISBN-10 of ISBN-13 (cijfers, eventueel met streepjes/spaties)."),
});

export const lookupBookDefinition = {
  name: "lookup_book",
  description:
    "Zoek een boek op via Google Books API met ISBN (geschikt voor barcode-scan op boekenkast, Feat 19). Returnt titel, auteurs, uitgever, jaar, taal, cover-image, pagina's. Gratis (1000/dag).",
  inputSchema: z.toJSONSchema(schema),
};

export async function handleLookupBook(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return errorContent(
      `Ongeldige invoer: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  try {
    // Directe lookup via de gedeelde implementatie — geen Edge Function
    // dependency meer voor deze tool.
    const result = await lookupBook(parsed.data.isbn);
    return jsonContent(result, `Boek lookup voor ISBN ${parsed.data.isbn}:`);
  } catch (err) {
    return errorContent(err instanceof Error ? err.message : "Lookup mislukt");
  }
}
