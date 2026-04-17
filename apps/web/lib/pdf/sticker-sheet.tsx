import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// Layout-constanten volgen PLAN.md sectie 10 exact.
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const QUARTER_WIDTH_MM = PAGE_WIDTH_MM / 2;       // 105
const QUARTER_HEIGHT_MM = PAGE_HEIGHT_MM / 2;     // 148.5

const GRID_COLS = 5;
const GRID_ROWS = 8;
const STICKER_WIDTH_MM = 21;
const STICKER_HEIGHT_MM = 15;
const STICKERS_PER_QUARTER = GRID_COLS * GRID_ROWS; // 40
const STICKERS_PER_SHEET = STICKERS_PER_QUARTER * 4; // 160

const HEADER_HEIGHT_MM = 4;

// 4-cijferig zero-padded, bijv. 0042.
function pad(n: number) {
  return String(n).padStart(4, "0");
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    fontFamily: "Courier-Bold",
  },
  quartersWrap: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    width: `${PAGE_WIDTH_MM}mm`,
    height: `${PAGE_HEIGHT_MM}mm`,
  },
  quarter: {
    width: `${QUARTER_WIDTH_MM}mm`,
    height: `${QUARTER_HEIGHT_MM}mm`,
    display: "flex",
    flexDirection: "column",
  },
  quarterHeader: {
    height: `${HEADER_HEIGHT_MM}mm`,
    fontSize: 6,
    color: "#999999",
    textAlign: "center",
    paddingTop: "1mm",
    fontFamily: "Helvetica",
  },
  grid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    width: `${STICKER_WIDTH_MM * GRID_COLS}mm`,
    height: `${STICKER_HEIGHT_MM * GRID_ROWS}mm`,
  },
  sticker: {
    width: `${STICKER_WIDTH_MM}mm`,
    height: `${STICKER_HEIGHT_MM}mm`,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    // Dashed cut-lines tussen stickers — rechts+onder kant.
    borderRightWidth: 0.25,
    borderRightStyle: "dashed",
    borderRightColor: "#cccccc",
    borderBottomWidth: 0.25,
    borderBottomStyle: "dashed",
    borderBottomColor: "#cccccc",
  },
  stickerText: {
    fontSize: 11,
    color: "#000000",
    letterSpacing: 0.5,
  },
});

export type StickerSheetProps = {
  startNumber: number;   // bijv. 1
  count?: number;        // default 160
};

function Quarter({ from, to }: { from: number; to: number }) {
  const numbers: number[] = [];
  for (let n = from; n <= to; n++) numbers.push(n);
  return (
    <View style={styles.quarter}>
      <Text style={styles.quarterHeader}>
        {pad(from)}–{pad(to)}
      </Text>
      <View style={styles.grid}>
        {numbers.map((n) => (
          <View key={n} style={styles.sticker}>
            <Text style={styles.stickerText}>{pad(n)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function StickerSheet({
  startNumber,
  count = STICKERS_PER_SHEET,
}: StickerSheetProps) {
  const sheets: Array<{ start: number; end: number }> = [];
  for (let offset = 0; offset < count; offset += STICKERS_PER_SHEET) {
    sheets.push({
      start: startNumber + offset,
      end: Math.min(startNumber + offset + STICKERS_PER_SHEET - 1, startNumber + count - 1),
    });
  }

  return (
    <Document title={`Stickervel ${pad(startNumber)}`}>
      {sheets.map((sheet) => {
        // Per A4-vel: 4 kwartieren van 40 elk.
        const quarters: Array<{ from: number; to: number }> = [];
        for (let q = 0; q < 4; q++) {
          const from = sheet.start + q * STICKERS_PER_QUARTER;
          const to = Math.min(from + STICKERS_PER_QUARTER - 1, sheet.end);
          if (from <= sheet.end) quarters.push({ from, to });
        }
        return (
          <Page key={sheet.start} size="A4" style={styles.page}>
            <View style={styles.quartersWrap}>
              {quarters.map((q) => (
                <Quarter key={q.from} from={q.from} to={q.to} />
              ))}
            </View>
          </Page>
        );
      })}
    </Document>
  );
}

export const STICKERS_PER_A4 = STICKERS_PER_SHEET;
