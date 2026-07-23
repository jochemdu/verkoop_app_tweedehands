import { z } from "zod";
import {
  PRODUCT_CONDITIONS,
  PRODUCT_STATUSES,
  PHOTO_TYPES,
  STICKER_INPUT_METHODS,
} from "./enums";
import { SHIPPING_CLASSES } from "./shipping";

// Sticker-ID = optionele categorie-prefix (0-6 hoofdletters) + 4-cijferig
// zero-padded nummer (0001-9999). Bijv. "0042" of "MEM0001". Geen prefix blijft
// volledig backward-compatible met de oude 4-cijferige stickers.
export const stickerIdSchema = z
  .string()
  .regex(
    /^[A-Z]{0,6}\d{4}$/,
    "Sticker-ID = optionele prefix (hoofdletters) + 4 cijfers, bijv. 0042 of MEM0001.",
  );

// Categorie-prefix: 1-6 hoofdletters (bijv. MEM voor geheugen).
export const stickerPrefixSchema = z
  .string()
  .regex(/^[A-Z]{1,6}$/, "Prefix = 1-6 hoofdletters (bijv. MEM).");

export const emailSchema = z.string().email("Ongeldig e-mailadres.");

export const loginSchema = z.object({
  email: emailSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

// Product insert (Fase A — indexering).
// Zie stickerSheetGenerateSchema voor de input/output split-pattern.
export const productIndexSchema = z.object({
  sticker_id: stickerIdSchema.optional(),
  sticker_input_method: z.enum(STICKER_INPUT_METHODS).optional(),
  sticker_confidence: z.number().min(0).max(1).optional(),
  category_slug: z.string().regex(/^[a-z0-9_]+$/).default("unknown"),
  working_title: z.string().max(200).optional(),
  indexing_notes: z.string().max(1000).optional(),
  ean: z.string().regex(/^\d{8,14}$/).optional(),
});
export type ProductIndexInput = z.input<typeof productIndexSchema>;
export type ProductIndexData = z.output<typeof productIndexSchema>;

// Product update (Fase B — verkoop). specs is bewust niet opgenomen — die
// komt via een ander pad (Claude MCP bundel update of categorie-spec form).
export const productUpdateSchema = z.object({
  // Sticker achteraf koppelen (bijv. aan een stub uit de kamer-scan).
  sticker_id: stickerIdSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  condition: z.enum(PRODUCT_CONDITIONS).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  defects: z.array(z.string()).optional(),
  included_accessories: z.array(z.string()).optional(),
  missing_items: z.array(z.string()).optional(),
  estimated_value_min: z.number().nonnegative().optional(),
  estimated_value_max: z.number().nonnegative().optional(),
  recommended_price: z.number().nonnegative().optional(),
  // Verkoop vastleggen (verkoopprijs-formulier).
  sold_price: z.number().nonnegative().optional(),
  sold_at: z.string().datetime().optional(),
  // Verzendklasse-override (anders afgeleid uit categorie).
  shipping_class: z.enum(SHIPPING_CLASSES).optional(),
});
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

// Photo insert
export const photoInsertSchema = z.object({
  product_id: z.string().uuid(),
  storage_path: z.string().min(1),
  thumbnail_path: z.string().optional(),
  order_index: z.number().int().min(0).default(0),
  photo_type: z.enum(PHOTO_TYPES).default("general"),
  capture_mode: z.string().optional(),
  sticker_visible: z.boolean().default(false),
  detected_sticker: stickerIdSchema.optional(),
  ocr_confidence: z.number().min(0).max(1).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  size_bytes: z.number().int().positive().optional(),
});
export type PhotoInsertInput = z.infer<typeof photoInsertSchema>;

// Sticker label-formaten. De layout-maten (mm, grid) leven in de web-app
// (lib/pdf/sticker-sheet.tsx); hier alleen de keys zodat API + forms +
// (later) mobile dezelfde enum delen.
export const STICKER_PRESETS = [
  "compact_21x15",
  "medium_38x21",
  "large_63x38",
] as const;
export const stickerPresetSchema = z.enum(STICKER_PRESETS);
export type StickerPreset = z.infer<typeof stickerPresetSchema>;

// Sticker sheet generator input.
// We gebruiken z.input/z.output apart want de default op `count` betekent
// dat de gebruiker hem weg kan laten (input = optional) maar na parse is
// het altijd een number (output = required).
export const stickerSheetGenerateSchema = z.object({
  startNumber: z.number().int().min(1).max(9999),
  count: z.number().int().min(1).max(160).default(160),
  preset: stickerPresetSchema.default("compact_21x15"),
  withQr: z.boolean().default(false),
  // Optionele categorie-prefix: sticker-ID's worden PREFIX + 4 cijfers
  // (MEM0001) met een eigen doorlopende nummerreeks per prefix.
  prefix: stickerPrefixSchema.optional(),
  categorySlug: z.string().regex(/^[a-z0-9_]+$/).optional(),
});
export type StickerSheetGenerateInput = z.input<typeof stickerSheetGenerateSchema>;
export type StickerSheetGenerateData = z.output<typeof stickerSheetGenerateSchema>;

// Selectie-print: stickers voor specifieke (bestaande) producten herprinten.
// Geen teller-bump en geen range-registratie — dit is een reprint.
export const stickerSelectionPrintSchema = z.object({
  stickerIds: z.array(stickerIdSchema).min(1).max(160),
  preset: stickerPresetSchema.default("medium_38x21"),
  withQr: z.boolean().default(true),
});
export type StickerSelectionPrintInput = z.input<typeof stickerSelectionPrintSchema>;
export type StickerSelectionPrintData = z.output<typeof stickerSelectionPrintSchema>;
