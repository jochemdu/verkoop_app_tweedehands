// Dev-hulpje: rendert voorbeeld-PDFs van alle sticker-presets (met en zonder
// QR) zodat je layout-wijzigingen lokaal kunt controleren zonder de app te
// starten.
//
//   pnpm -F web exec tsx --tsconfig scripts/tsconfig.json scripts/render-sticker-samples.tsx [outputDir]
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { writeFileSync } from "node:fs";
import { STICKER_PRESETS } from "@verkoopassistent/shared";
import {
  StickerSheet,
  PRESET_LAYOUTS,
  type StickerLabel,
} from "../lib/pdf/sticker-sheet";

const OUT = process.argv[2] ?? ".";

async function labelsFor(count: number, withQr: boolean): Promise<StickerLabel[]> {
  const ids = Array.from({ length: count }, (_, i) => String(i + 1).padStart(4, "0"));
  if (!withQr) return ids.map((id) => ({ id }));
  return Promise.all(
    ids.map(async (id) => ({
      id,
      qrDataUrl: await QRCode.toDataURL(
        `https://verkoopassistent.vercel.app/inventory/${id}`,
        { errorCorrectionLevel: "M", margin: 0, scale: 8 },
      ),
    })),
  );
}

async function main() {
  for (const preset of STICKER_PRESETS) {
    const layout = PRESET_LAYOUTS[preset];
    for (const withQr of [false, true]) {
      // 1,5 vel om paginering te testen.
      const count = Math.ceil(layout.perSheet * 1.5);
      const labels = await labelsFor(count, withQr);
      const buf = await renderToBuffer(
        <StickerSheet labels={labels} preset={preset} />,
      );
      const name = `${OUT}/sticker-${preset}${withQr ? "-qr" : ""}.pdf`;
      writeFileSync(name, buf);
      console.log(`${name}: ${count} labels, ${(buf.length / 1024).toFixed(0)} KB`);
    }
  }
}

main().then(() => console.log("OK"));
