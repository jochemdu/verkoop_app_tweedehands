import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { stickerSheetGenerateSchema } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";
import { StickerSheet } from "@/lib/pdf/sticker-sheet";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = stickerSheetGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ongeldige invoer", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { startNumber, count } = parsed.data;
  const endNumber = startNumber + count - 1;

  // Guardrail: 4-cijferig sticker-ID domein is 0001–9999.
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
  // uitprint die al op producten zitten. Verwijder de bestaande sticker_sheets
  // rij als je echt wil herprinten.
  const { data: conflict } = await supabase
    .from("sticker_sheets")
    .select("id, start_number, end_number")
    .lte("start_number", endNumber)
    .gte("end_number", startNumber)
    .limit(1)
    .maybeSingle();
  if (conflict) {
    const pad = (n: number) => String(n).padStart(4, "0");
    return NextResponse.json(
      {
        error: `Bereik ${pad(startNumber)}–${pad(endNumber)} overlapt met bestaand vel ${pad(conflict.start_number)}–${pad(conflict.end_number)}. Verwijder eerst dat vel als je wil herprinten.`,
        conflictingSheet: conflict,
      },
      { status: 409 },
    );
  }

  // Genereer PDF in-memory.
  const buffer = await renderToBuffer(
    <StickerSheet startNumber={startNumber} count={count} />,
  );

  // Pad in storage: sticker-sheets/{start}-{end}-{timestamp}.pdf
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${String(startNumber).padStart(4, "0")}-${String(endNumber).padStart(4, "0")}-${timestamp}.pdf`;
  const storagePath = filename;

  const { error: uploadErr } = await supabase.storage
    .from("sticker-sheets")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json(
      { error: `Upload mislukt: ${uploadErr.message}` },
      { status: 500 },
    );
  }

  // Registreer in sticker_sheets tabel.
  const { data: sheetRow, error: insertErr } = await supabase
    .from("sticker_sheets")
    .insert({
      start_number: startNumber,
      end_number: endNumber,
      pdf_storage_path: storagePath,
    })
    .select()
    .single();
  if (insertErr) {
    // Best-effort cleanup: verwijder de upload als DB insert faalt.
    await supabase.storage.from("sticker-sheets").remove([storagePath]);
    return NextResponse.json(
      { error: `DB insert mislukt: ${insertErr.message}` },
      { status: 500 },
    );
  }

  // Bump de laatst-gebruikte sticker-nummer teller.
  // Rij is pre-seeded in 0001_initial_schema.sql dus update is voldoende.
  await supabase
    .from("app_settings")
    .update({ value: endNumber })
    .eq("key", "last_sticker_number");

  // Geef een 1-uur geldige signed URL terug zodat de gebruiker meteen kan
  // downloaden/printen.
  const { data: signed, error: signedErr } = await supabase.storage
    .from("sticker-sheets")
    .createSignedUrl(storagePath, 3600);
  if (signedErr || !signed) {
    return NextResponse.json(
      { error: `Signed URL mislukt: ${signedErr?.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    sheet: sheetRow,
    pdfUrl: signed.signedUrl,
    expiresInSeconds: 3600,
  });
}

