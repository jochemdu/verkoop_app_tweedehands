import { describe, it, expect } from "vitest";
import {
  estimateShipping,
  suggestShippingClass,
  SHIPPING_RATES,
} from "./shipping";

describe("suggestShippingClass", () => {
  it("kleine items → brievenbuspakje", () => {
    expect(suggestShippingClass("pokemon_card")).toBe("letterbox");
    expect(suggestShippingClass("books")).toBe("letterbox");
  });

  it("grote items → groot pakket", () => {
    expect(suggestShippingClass("furniture")).toBe("large");
    expect(suggestShippingClass("bicycles")).toBe("large");
  });

  it("onbekende of null categorie → parcel", () => {
    expect(suggestShippingClass("unknown")).toBe("parcel");
    expect(suggestShippingClass(null)).toBe("parcel");
    expect(suggestShippingClass("does_not_exist")).toBe("parcel");
  });
});

describe("estimateShipping", () => {
  it("gebruikt expliciete klasse boven categorie", () => {
    const est = estimateShipping({
      shippingClass: "large",
      categorySlug: "pokemon_card",
    });
    expect(est.shippingClass).toBe("large");
    expect(est.price).toBe(SHIPPING_RATES.large);
    expect(est.suggested).toBe(false);
  });

  it("valt terug op categorie als klasse ontbreekt", () => {
    const est = estimateShipping({
      shippingClass: null,
      categorySlug: "books",
    });
    expect(est.shippingClass).toBe("letterbox");
    expect(est.price).toBe(SHIPPING_RATES.letterbox);
    expect(est.suggested).toBe(true);
  });

  it("negeert een ongeldige klasse en gebruikt de categorie", () => {
    const est = estimateShipping({
      shippingClass: "rubbish",
      categorySlug: "smartphone",
    });
    expect(est.shippingClass).toBe("parcel");
    expect(est.suggested).toBe(true);
  });
});
