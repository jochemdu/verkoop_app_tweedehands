import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace";

export const runtime = "nodejs";

// Beheer van de categorie→prefix-map (bijv. { ram_dimm: "MEM" }). Opgeslagen als
// één jsonb-rij per workspace in app_settings. Zo krijgt elke categorie een
// eigen, unieke sticker-code-reeks — los van het printmoment.
const bodySchema = z.object({
  prefixes: z.record(
    z.string().regex(/^[a-z0-9_]+$/),
    z.string().regex(/^[A-Z]{0,6}$/),
  ),
});

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ongeldige invoer", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Lege prefixes = geen prefix → uit de map halen.
  const clean: Record<string, string> = {};
  for (const [slug, prefix] of Object.entries(parsed.data.prefixes)) {
    if (prefix) clean[slug] = prefix;
  }

  // Uniekheid: elke prefix mag maar aan één categorie hangen, anders delen twee
  // categorieën dezelfde nummerreeks en zijn de codes niet meer uniek.
  const seen = new Map<string, string>();
  for (const [slug, prefix] of Object.entries(clean)) {
    const existing = seen.get(prefix);
    if (existing) {
      return NextResponse.json(
        {
          error: `Prefix "${prefix}" is aan meerdere categorieën gekoppeld (${existing} en ${slug}). Elke prefix mag maar één categorie hebben.`,
        },
        { status: 409 },
      );
    }
    seen.set(prefix, slug);
  }

  const wsId = await getActiveWorkspaceId(supabase);
  if (!wsId) {
    return NextResponse.json({ error: "Geen actieve workspace" }, { status: 400 });
  }

  const { error } = await supabase.from("app_settings").upsert(
    {
      key: "category_prefixes",
      value: clean,
      user_id: user.id,
      workspace_id: wsId,
    },
    { onConflict: "key,workspace_id" },
  );
  if (error) {
    return NextResponse.json(
      { error: `Opslaan mislukt: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ saved: Object.keys(clean).length, prefixes: clean });
}
