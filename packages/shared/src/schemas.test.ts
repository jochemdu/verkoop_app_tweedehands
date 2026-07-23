import { describe, it, expect } from "vitest";
import {
  stickerIdSchema,
  loginSchema,
  productIndexSchema,
  stickerSheetGenerateSchema,
} from "./schemas";

describe("stickerIdSchema", () => {
  it("accepteert 4 cijfers", () => {
    expect(stickerIdSchema.safeParse("0042").success).toBe(true);
    expect(stickerIdSchema.safeParse("9999").success).toBe(true);
  });
  it("accepteert een hoofdletter-prefix + 4 cijfers", () => {
    expect(stickerIdSchema.safeParse("MEM0001").success).toBe(true);
    expect(stickerIdSchema.safeParse("A0042").success).toBe(true);
  });
  it("weigert verkeerde lengte", () => {
    expect(stickerIdSchema.safeParse("42").success).toBe(false);
    expect(stickerIdSchema.safeParse("00042").success).toBe(false);
    expect(stickerIdSchema.safeParse("MEM042").success).toBe(false);
  });
  it("weigert kleine letters of te lange prefix", () => {
    expect(stickerIdSchema.safeParse("mem0001").success).toBe(false);
    expect(stickerIdSchema.safeParse("TOOLONG0001").success).toBe(false);
  });
  it("weigert non-digits", () => {
    expect(stickerIdSchema.safeParse("0abc").success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepteert geldig emailadres", () => {
    expect(loginSchema.safeParse({ email: "jij@voorbeeld.nl" }).success).toBe(true);
  });
  it("weigert ongeldig emailadres", () => {
    expect(loginSchema.safeParse({ email: "niet-een-email" }).success).toBe(false);
  });
});

describe("productIndexSchema", () => {
  it("default category_slug is 'unknown'", () => {
    const parsed = productIndexSchema.parse({});
    expect(parsed.category_slug).toBe("unknown");
  });
  it("accepteert optionele sticker_id", () => {
    expect(productIndexSchema.safeParse({ sticker_id: "0042" }).success).toBe(true);
  });
  it("weigert invalid EAN", () => {
    expect(productIndexSchema.safeParse({ ean: "123" }).success).toBe(false);
  });
  it("accepteert EAN-13", () => {
    expect(productIndexSchema.safeParse({ ean: "4006381333641" }).success).toBe(true);
  });
});

describe("stickerSheetGenerateSchema", () => {
  it("default count is 160", () => {
    const parsed = stickerSheetGenerateSchema.parse({ startNumber: 1 });
    expect(parsed.count).toBe(160);
  });
  it("weigert startNumber 0 of >9999", () => {
    expect(stickerSheetGenerateSchema.safeParse({ startNumber: 0 }).success).toBe(false);
    expect(stickerSheetGenerateSchema.safeParse({ startNumber: 10000 }).success).toBe(false);
  });
  it("weigert count > 160", () => {
    expect(
      stickerSheetGenerateSchema.safeParse({ startNumber: 1, count: 200 }).success,
    ).toBe(false);
  });
});
