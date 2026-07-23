import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import {
  stickerSheetGenerateSchema,
  stickerSelectionPrintSchema,
  type StickerPreset,
} from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { aiRateLimit } from "@/lib/rate-limit";
import { StickerSheet, type StickerLabel } from "@/lib/pdf/sticker-sheet";

export const runtime = "nodejs";

const pad = (n: number) => String(n).padStart(4, "0");

// QR verwijst naar de productpagina zodat een scan op een doos/bak direct
// het item opent. Werkt ook vóór het product bestaat: de pagina resolvet
// op sticker-ID zodra het item geïndexeerd is.
function qrTarget(req: NextRequest, stickerId: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    new URL(req.url).origin;
  return `${base}/inventory/${stickerId}`;
}

async function buildLabels(
  req: NextRequest,
  ids: string[],
  withQr: boolean,
): Promise<StickerLabel[]> {
  if (!withQr) return ids.map((id) => ({ id }));
  return Promise.all(
    ids.map(async (id) => ({
      id,
      qrDataUrl: await QRCode.toDataURL(qrTarget(req, id), {
        errorCorrectionLevel: "M",
        margin: 0,
        scale: 8,
      }),
    })),
  );
}

async function renderAndUpload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  req: NextRequest,
  ids: string[],
  preset: StickerPreset,
  withQr: boolean,
  filename: string,
) {
  const labels = await buildLabels(req, ids, withQr);
  const buffer = await renderToBuffer(
    <StickerSheet labels={labels} preset={preset} />,
  );
  const { error: uploadErr } = await supabase.storage
    .from("sticker-sheets")
    .upload(filename, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadErr) {
    return { error: `Upload mislukt: ${uploadErr.message}` } as const;
  }
  const { data: signed, error: signedErr } = await supabase.storage
    .from("sticker-sheets")
    .createSignedUrl(filename, 3600);
  if (signedErr || !signed) {
    return { error: `Signed URL mislukt: ${signedErr?.message}` } as const;
  }
  return { pdfUrl: signed.signedUrl, storagePath: filename } as const;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const rl = aiRateLimit(user.id, "stickers");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Te veel zware verzoeken — wacht een paar minuten." },
      { status: 429 },
    );
  }

  const body = await req.json();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  // Modus 2: selectie-print (specifieke sticker-IDs, bijv. herprint vanuit
  // de inventaris). Geen teller-bump, geen range-registratie.
  if (Array.isArray((body as { stickerIds?: unknown })?.stickerIds)) {
    const parsed = stickerSelectionPrintSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ongeldige invoer", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { stickerIds, preset, withQr } = parsed.data;
    const unique = [...new Set(stickerIds)].sort();
    const result = await renderAndUpload(
      supabase,
      req,
      unique,
      preset,
      withQr,
      `${user.id}/selectie-${unique[0]}-${unique.length}x-${timestamp}.pdf`,
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({
      mode: "selection",
      count: unique.length,
      pdfUrl: result.pdfUrl,
      expiresInSeconds: 3600,
    });
  }

  // Modus 1: nieuw nummerbereik.
  const parsed = stickerSheetGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ongeldige invoer", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { startNumber, count, preset, withQr, prefix, categorySlug } = parsed.data;
  const pre = prefix ?? "";
  const endNumber = startNumber + count - 1;
  // Sticker-ID = optionele prefix + 4-cijferig nummer (MEM0001). Zonder prefix
  // exact zoals voorheen (0001).
  const label = (n: number) => `${pre}${pad(n)}`;

  // Guardrail: 4-cijferig nummerdomein is 0001–9999 (los van de prefix).
  if (endNumber > 9999) {
    return NextResponse.json(
      {
        error: `Bereik loopt buiten 0001–9999 (${startNumber}–${endNumber}). Kies een lager startnummer of lager aantal.`,
      },
      { status: 400 },
    );
  }

  // Overlap-detectie: twee ranges [a,b] en [c,d] overlappen als a ≤ d én c ≤ b.
  // In SQL: start_number ≤ endNumber AND end_number ≥ startNumber.
  // Gedrag: blokkeren met 409 zodat je niet per ongeluk dubbele sticker-ID's
  // uitprint die al op producten zitten. Herprinten van bestaande nummers kan
  // via de selectie-print op /inventory.
  // Overlap-check per prefix: MEM-ranges botsen niet met de kale reeks.
  const { data: conflict } = await supabase
    .from("sticker_sheets")
    .select("id, start_number, end_number")
    .eq("prefix", pre)
    .lte("start_number", endNumber)
    .gte("end_number", startNumber)
    .limit(1)
    .maybeSingle();
  if (conflict) {
    return NextResponse.json(
      {
        error: `Bereik ${label(startNumber)}–${label(endNumber)} overlapt met bestaand vel ${label(conflict.start_number)}–${label(conflict.end_number)}. Gebruik de selectie-print op /inventory om te herprinten.`,
        conflictingSheet: conflict,
      },
      { status: 409 },
    );
  }

  const ids = Array.from({ length: count }, (_, i) => label(startNumber + i));
  const result = await renderAndUpload(
    supabase,
    req,
    ids,
    preset,
    withQr,
    `${user.id}/${label(startNumber)}-${label(endNumber)}-${timestamp}.pdf`,
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Registreer in sticker_sheets tabel.
  const { data: sheetRow, error: insertErr } = await supabase
    .from("sticker_sheets")
    .insert({
      start_number: startNumber,
      end_number: endNumber,
      prefix: pre,
      pdf_storage_path: result.storagePath,
      notes: `${pre ? `${pre} · ` : ""}${preset}${withQr ? " + QR" : ""}`,
      user_id: user.id,
    })
    .select()
    .single();
  if (insertErr) {
    // Best-effort cleanup: verwijder de upload als DB insert faalt.
    await supabase.storage.from("sticker-sheets").remove([result.storagePath]);
    // 23P01 = exclusion_violation: een gelijktijdige print claimde dit bereik al
    // tussen onze overlap-check en insert in. De DB-constraint vangt de race af.
    if (insertErr.code === "23P01") {
      return NextResponse.json(
        {
          error: `Bereik ${pad(startNumber)}–${pad(endNumber)} overlapt met een zojuist aangemaakt vel. Kies een ander startnummer en probeer opnieuw.`,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: `DB insert mislukt: ${insertErr.message}` },
      { status: 500 },
    );
  }

  // Bump de laatst-gebruikte teller (per workspace én per prefix; upsert zodat
  // een workspace zonder teller-rij ook werkt). Zonder prefix = de kale reeks.
  const wsId = await getActiveWorkspaceId(supabase);
  if (wsId) {
    const counterKey = pre ? `last_sticker_number:${pre}` : "last_sticker_number";
    await supabase.from("app_settings").upsert(
      {
        key: counterKey,
        value: endNumber,
        user_id: user.id,
        workspace_id: wsId,
      },
      { onConflict: "key,workspace_id" },
    );

    // Onthoud de categorie→prefix-koppeling zodat de generator hem later
    // voorstelt. Opgeslagen als één jsonb-map per workspace.
    if (categorySlug && pre) {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "category_prefixes")
        .eq("workspace_id", wsId)
        .maybeSingle();
      const map = {
        ...((existing?.value as Record<string, string> | null) ?? {}),
        [categorySlug]: pre,
      };
      await supabase.from("app_settings").upsert(
        {
          key: "category_prefixes",
          value: map,
          user_id: user.id,
          workspace_id: wsId,
        },
        { onConflict: "key,workspace_id" },
      );
    }
  }

  return NextResponse.json({
    mode: "range",
    sheet: sheetRow,
    pdfUrl: result.pdfUrl,
    expiresInSeconds: 3600,
  });
}
