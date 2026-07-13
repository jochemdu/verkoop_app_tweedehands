import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { aiRateLimit } from "@/lib/rate-limit";
import { runRoomAudit } from "@/lib/ai/room-audit";

export const runtime = "nodejs";
// Vision over meerdere kamerfoto's kan even duren (adaptive thinking).
export const maxDuration = 300;

const MAX_PHOTOS = 4;

// Kamerfoto's staan in product-photos onder {user_id}/room-audits/<file> —
// zelfde bucket-isolatie als de inbox, aparte map zodat ze nooit in de
// bulk-upload flow terechtkomen.
const FILENAME_RE = /^[A-Za-z0-9._-]{1,200}\.(jpe?g|png|webp|heic|heif)$/i;

function isSafeRoomAuditPath(path: string, userId: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 3) return false;
  const [uid, folder, filename] = parts as [string, string, string];
  return (
    uid.toLowerCase() === userId.toLowerCase() &&
    folder === "room-audits" &&
    FILENAME_RE.test(filename)
  );
}

const bodySchema = z.object({
  photo_paths: z.array(z.string().min(1)).min(1).max(MAX_PHOTOS),
  room_name: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const rl = aiRateLimit(user.id, "room-audit");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Te veel zware verzoeken — wacht een paar minuten." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige invoer" }, { status: 400 });
  }
  const { photo_paths, room_name } = parsed.data;
  if (!photo_paths.every((p) => isSafeRoomAuditPath(p, user.id))) {
    return NextResponse.json({ error: "Ongeldig storage pad" }, { status: 400 });
  }

  // Kamerfoto's zijn tijdelijke scan-input — na afloop (ook bij fouten)
  // altijd uit storage verwijderen, zodat er niets privés blijft hangen.
  try {
    // Signed URLs die het model kan ophalen. 15 min is ruim voldoende.
    const { data: signed, error: signErr } = await supabase.storage
      .from("product-photos")
      .createSignedUrls(photo_paths, 900);
    if (signErr) {
      return NextResponse.json({ error: signErr.message }, { status: 500 });
    }
    const photoUrls = (signed ?? [])
      .map((s) => s.signedUrl)
      .filter((u): u is string => Boolean(u));
    if (photoUrls.length === 0) {
      return NextResponse.json(
        { error: "Geen kamerfoto's gevonden in storage." },
        { status: 400 },
      );
    }

    // Inventaris (voor de dubbel-check) + actuele categorielijst (fase 22).
    const [{ data: products }, { data: categories }] = await Promise.all([
      supabase
        .from("products")
        .select("title, working_title")
        .is("deleted_at", null),
      supabase.from("categories").select("slug"),
    ]);
    const inventoryTitles = (products ?? [])
      .map((p) => p.title ?? p.working_title)
      .filter((t): t is string => Boolean(t));

    const { audit, model, usage } = await runRoomAudit({
      photoUrls,
      roomName: room_name ?? null,
      inventoryTitles,
      categorySlugs: (categories ?? []).map((c) => c.slug),
    });

    await supabase.from("claude_analyses").insert({
      analysis_type: "room_audit",
      claude_source: "web_pipeline",
      user_prompt: `Room audit "${room_name ?? "onbekende ruimte"}" (${photoUrls.length} foto's, model ${model})`,
      claude_response: { audit, usage } as never,
      applied: false,
      user_id: user.id,
    });

    return NextResponse.json({ audit, model });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Room audit mislukt" },
      { status: 502 },
    );
  } finally {
    await supabase.storage.from("product-photos").remove(photo_paths);
  }
}
