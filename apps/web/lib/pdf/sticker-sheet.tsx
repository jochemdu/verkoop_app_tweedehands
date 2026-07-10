import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { StickerPreset } from "@verkoopassistent/shared";

// A4 in mm.
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;

// Layout per preset. Alles is een knip-zelf-grid met stippellijnen, gecentreerd
// op A4. `qrSizeMm: 0` betekent: QR past niet op dit formaat.
export type PresetLayout = {
  label: string;
  widthMm: number;
  heightMm: number;
  cols: number;
  rows: number;
  fontSize: number;
  qrSizeMm: number;
  perSheet: number;
};

export const PRESET_LAYOUTS: Record<StickerPreset, PresetLayout> = {
  // Origineel formaat (PLAN.md sectie 10): 10×16 = 160 per vel.
  compact_21x15: {
    label: "Compact 21×15 mm (160/vel)",
    widthMm: 21,
    heightMm: 15,
    cols: 10,
    rows: 16,
    fontSize: 11,
    qrSizeMm: 9,
    perSheet: 160,
  },
  medium_38x21: {
    label: "Middel 38×21 mm (65/vel)",
    widthMm: 38,
    heightMm: 21,
    cols: 5,
    rows: 13,
    fontSize: 13,
    qrSizeMm: 16,
    perSheet: 65,
  },
  large_63x38: {
    label: "Groot 63×38 mm (21/vel)",
    widthMm: 63,
    heightMm: 38,
    cols: 3,
    rows: 7,
    fontSize: 20,
    qrSizeMm: 30,
    perSheet: 21,
  },
};

export type StickerLabel = {
  id: string; // "0042"
  qrDataUrl?: string; // PNG data-URL; alleen gezet als withQr aan staat
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    fontFamily: "Courier-Bold",
  },
  header: {
    fontSize: 6,
    color: "#999999",
    textAlign: "center",
    fontFamily: "Helvetica",
  },
  grid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    // Stippellijn-kniplijnen rechts + onder.
    borderRightWidth: 0.25,
    borderRightStyle: "dashed",
    borderRightColor: "#cccccc",
    borderBottomWidth: 0.25,
    borderBottomStyle: "dashed",
    borderBottomColor: "#cccccc",
  },
  idText: {
    color: "#000000",
    letterSpacing: 0.5,
  },
});

export type StickerSheetProps = {
  labels: StickerLabel[];
  preset: StickerPreset;
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function StickerCell({ label, layout }: { label: StickerLabel; layout: PresetLayout }) {
  const withQr = Boolean(label.qrDataUrl) && layout.qrSizeMm > 0;
  // Bij QR op compact-formaat schaalt het nummer iets terug voor de ruimte.
  const fontSize = withQr && layout.widthMm <= 21 ? 8 : layout.fontSize;
  return (
    <View
      style={[
        styles.cell,
        {
          width: `${layout.widthMm}mm`,
          height: `${layout.heightMm}mm`,
          gap: "1mm",
          flexDirection: layout.widthMm > layout.heightMm * 1.4 ? "row" : "column",
        },
      ]}
    >
      {withQr && (
        <Image
          src={label.qrDataUrl!}
          style={{ width: `${layout.qrSizeMm}mm`, height: `${layout.qrSizeMm}mm` }}
        />
      )}
      <Text style={[styles.idText, { fontSize }]}>{label.id}</Text>
    </View>
  );
}

export function StickerSheet({ labels, preset }: StickerSheetProps) {
  const layout = PRESET_LAYOUTS[preset];
  const pages = chunk(labels, layout.perSheet);
  // +1mm speling: bij exact 210mm (compact: 10×21) duwt pt-afronding de
  // laatste kolom anders naar de volgende regel.
  const gridWidth = layout.widthMm * layout.cols + 1;
  const gridHeight = layout.heightMm * layout.rows;
  const marginX = Math.max(0, (PAGE_WIDTH_MM - gridWidth) / 2);
  // Boven het grid: 4mm headerregel; rest centreert.
  const marginY = Math.max(4, (PAGE_HEIGHT_MM - gridHeight - 4) / 2);
  const first = labels[0]?.id ?? "";
  const last = labels[labels.length - 1]?.id ?? "";

  return (
    <Document title={`Stickervel ${first}–${last}`}>
      {pages.map((pageLabels, pageIdx) => (
        <Page key={pageIdx} size="A4" style={styles.page}>
          <View style={{ paddingTop: `${marginY - 4}mm` }}>
            <Text style={[styles.header, { height: "4mm", paddingTop: "1mm" }]}>
              {pageLabels[0]?.id}–{pageLabels[pageLabels.length - 1]?.id} ·{" "}
              {layout.label}
            </Text>
            <View
              style={[
                styles.grid,
                {
                  width: `${gridWidth}mm`,
                  marginLeft: `${marginX}mm`,
                },
              ]}
            >
              {pageLabels.map((label) => (
                <StickerCell key={label.id} label={label} layout={layout} />
              ))}
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
}

export const STICKERS_PER_A4 = PRESET_LAYOUTS.compact_21x15.perSheet;
