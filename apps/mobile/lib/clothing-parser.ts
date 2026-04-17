// Lichtgewicht parser die brand + size + color probeert te detecteren uit
// OCR tekst van een kleding-label. Bewust simpel gehouden — werkt voor ~60%
// gangbare labels. Claude-analyse via MCP kan de rest vangen.

const SIZE_PATTERNS = [
  /\bEU\s*\d{2,3}\b/i,
  /\bUK\s*\d{1,2}\b/i,
  /\bUS\s*\d{1,2}\b/i,
  /\b(?:XXS|XS|S|M|L|XL|XXL|XXXL|3XL|4XL)\b/,
  /\b(?:SIZE|MAAT)\s*[:\-]?\s*(?:XXS|XS|S|M|L|XL|XXL|3XL|4XL|\d{2,3})\b/i,
  /\b\d{2}\/\d{2}\b/, // bijv. "32/34" (broek)
];

const MATERIAL_KEYWORDS = [
  "COTTON",
  "KATOEN",
  "POLYESTER",
  "WOOL",
  "WOL",
  "LINEN",
  "LINNEN",
  "SILK",
  "ZIJDE",
  "LEATHER",
  "LEDER",
  "DENIM",
  "VISCOSE",
  "NYLON",
];

// Basic NL + EN brand hints. Uitbreidbaar.
const KNOWN_BRANDS = [
  "Nike",
  "Adidas",
  "Puma",
  "H&M",
  "Zara",
  "Uniqlo",
  "Levi's",
  "Tommy Hilfiger",
  "G-Star",
  "Scotch & Soda",
  "McGregor",
  "Suit Supply",
  "Essentiel",
  "Mango",
  "Bershka",
  "Lacoste",
  "Ralph Lauren",
  "Hugo Boss",
  "Calvin Klein",
  "Diesel",
  "Vanilia",
  "Chasin",
  "PME Legend",
  "Cast Iron",
];

export type ClothingInfo = {
  brand: string | null;
  size: string | null;
  material: string | null;
};

export function parseClothingLabel(ocrText: string): ClothingInfo {
  const text = ocrText.replace(/\s+/g, " ").trim();

  let brand: string | null = null;
  for (const b of KNOWN_BRANDS) {
    const re = new RegExp(`\\b${escapeRegex(b)}\\b`, "i");
    if (re.test(text)) {
      brand = b;
      break;
    }
  }

  let size: string | null = null;
  for (const pat of SIZE_PATTERNS) {
    const m = text.match(pat);
    if (m) {
      size = m[0]
        .replace(/^SIZE[:\-\s]*/i, "")
        .replace(/^MAAT[:\-\s]*/i, "")
        .trim();
      break;
    }
  }

  let material: string | null = null;
  const upper = text.toUpperCase();
  for (const m of MATERIAL_KEYWORDS) {
    if (upper.includes(m)) {
      material = m.toLowerCase();
      break;
    }
  }

  return { brand, size, material };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
