import {
  resolveProductId as sharedResolveProductId,
  resolveProductIds as sharedResolveProductIds,
} from "@verkoopassistent/shared";
import { getSupabase } from "./supabase.js";

// Dunne wrappers om de gedeelde repo-laag: zelfde semantiek als voorheen,
// maar de logica leeft nu in packages/shared/src/repo.ts (één implementatie
// voor web + MCP).

export async function resolveProductId(identifier: string): Promise<string> {
  return sharedResolveProductId(getSupabase(), identifier);
}

export async function resolveProductIds(
  identifiers: string[],
): Promise<{ resolved: string[]; missing: string[] }> {
  return sharedResolveProductIds(getSupabase(), identifiers);
}
