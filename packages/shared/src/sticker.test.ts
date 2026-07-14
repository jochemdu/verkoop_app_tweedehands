import { describe, it, expect } from "vitest";
import { padSticker, stickerRange } from "./sticker";

describe("padSticker", () => {
  it("padt naar 4 cijfers", () => {
    expect(padSticker(0)).toBe("0000");
    expect(padSticker(42)).toBe("0042");
    expect(padSticker(123)).toBe("0123");
    expect(padSticker(9999)).toBe("9999");
  });
});

describe("stickerRange", () => {
  it("bouwt een opeenvolgende reeks vanaf start", () => {
    expect(stickerRange(42, 3)).toEqual(["0042", "0043", "0044"]);
  });
  it("clampt bij 9999 en overschrijdt die nooit", () => {
    expect(stickerRange(9998, 5)).toEqual(["9998", "9999"]);
  });
  it("geeft een lege array bij count 0", () => {
    expect(stickerRange(42, 0)).toEqual([]);
  });
  it("geeft een lege array bij negatieve count", () => {
    expect(stickerRange(42, -3)).toEqual([]);
  });
  it("werkt met count 1", () => {
    expect(stickerRange(7, 1)).toEqual(["0007"]);
  });
});
