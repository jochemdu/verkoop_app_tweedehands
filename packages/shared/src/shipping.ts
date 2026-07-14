// Verzendkosten-schatting (NL). Producten hebben geen gewicht/afmetingen, dus we
// werken met een verzendklasse die uit de categorie wordt afgeleid en handmatig
// overschreven kan worden. Tarieven zijn indicatieve PostNL-prijzen (met tracking),
// afgerond en bewust conservatief; later evt. per vervoerder configureerbaar.

export const SHIPPING_CLASSES = ["letterbox", "parcel", "large"] as const;
export type ShippingClass = (typeof SHIPPING_CLASSES)[number];

export const SHIPPING_RATES: Record<ShippingClass, number> = {
  letterbox: 4.15, // brievenbuspakje tot ~2 kg
  parcel: 6.95, // pakket tot 10 kg
  large: 13.1, // groot pakket tot 23 kg
};

// Heuristische mapping categorie → verzendklasse. Onbekende categorieën vallen
// terug op "parcel" (het meest voorkomende geval).
const CATEGORY_TO_CLASS: Record<string, ShippingClass> = {
  pokemon_card: "letterbox",
  jewelry: "letterbox",
  watches: "letterbox",
  accessories: "letterbox",
  books: "letterbox",
  console_game: "letterbox",
  vinyl_music: "letterbox",
  ram_dimm: "letterbox",
  ram_sodimm: "letterbox",
  cpu: "letterbox",
  antique_silver: "letterbox",
  clothing: "parcel",
  shoes: "parcel",
  handbags: "parcel",
  smartphone: "parcel",
  gpu: "parcel",
  laptop: "parcel",
  toys: "parcel",
  board_games: "parcel",
  kitchenware: "parcel",
  tools: "parcel",
  sports: "parcel",
  home_decor: "parcel",
  garden: "parcel",
  electronics_other: "parcel",
  antique_tin: "parcel",
  antique_other: "parcel",
  console: "parcel",
  furniture: "large",
  bicycles: "large",
};

export function suggestShippingClass(
  categorySlug: string | null,
): ShippingClass {
  if (categorySlug && categorySlug in CATEGORY_TO_CLASS) {
    return CATEGORY_TO_CLASS[categorySlug]!;
  }
  return "parcel";
}

export type ShippingEstimate = {
  shippingClass: ShippingClass;
  price: number;
  // true als de klasse is afgeleid uit de categorie (geen handmatige keuze).
  suggested: boolean;
};

export function estimateShipping(opts: {
  shippingClass?: string | null;
  categorySlug?: string | null;
}): ShippingEstimate {
  const explicit =
    opts.shippingClass &&
    (SHIPPING_CLASSES as readonly string[]).includes(opts.shippingClass)
      ? (opts.shippingClass as ShippingClass)
      : null;
  const cls = explicit ?? suggestShippingClass(opts.categorySlug ?? null);
  return {
    shippingClass: cls,
    price: SHIPPING_RATES[cls],
    suggested: explicit === null,
  };
}
