import { getSupabase } from "./supabase";

// Accepteert zowel een UUID als een 4-cijferig sticker-ID en returnt de UUID.
// Gooit een error als het product niet bestaat.
export async function resolveProductId(identifier: string): Promise<string> {
  const supabase = getSupabase();
  if (/^\d{4}$/.test(identifier)) {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("sticker_id", identifier)
      .maybeSingle();
    if (error) throw new Error(`DB fout: ${error.message}`);
    if (!data)
      throw new Error(
        `Geen product met sticker-ID ${identifier}. Controleer de sticker of gebruik list_inventory.`,
      );
    return data.id;
  }
  // Treat als UUID en valideer dat het bestaat.
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("id", identifier)
    .maybeSingle();
  if (error) throw new Error(`DB fout: ${error.message}`);
  if (!data) throw new Error(`Geen product met id ${identifier}.`);
  return data.id;
}

// Batch-versie voor suggest_bundle etc.
export async function resolveProductIds(
  identifiers: string[],
): Promise<{ resolved: string[]; missing: string[] }> {
  const resolved: string[] = [];
  const missing: string[] = [];
  for (const ident of identifiers) {
    try {
      resolved.push(await resolveProductId(ident));
    } catch {
      missing.push(ident);
    }
  }
  return { resolved, missing };
}
