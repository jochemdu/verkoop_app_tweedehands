// Explicit named re-exports (in plaats van `export *`) zodat zowel tsx ESM
// als Next.js transpilePackages de runtime exports betrouwbaar vinden.
// `.js` extensies zijn vereist voor Node's ESM resolver.

export {
  PRODUCT_CONDITIONS,
  PRODUCT_STATUSES,
  LISTING_STATUSES,
  PHOTO_TYPES,
  STICKER_INPUT_METHODS,
  PLATFORM_SLUGS,
  BUYBACK_SERVICE_SLUGS,
  CATEGORY_SLUGS,
  BUNDLE_TYPES,
  type ProductCondition,
  type ProductStatus,
  type ListingStatus,
  type PhotoType,
  type StickerInputMethod,
  type PlatformSlug,
  type BuybackServiceSlug,
  type CategorySlug,
  type BundleType,
} from "./enums";

export {
  stickerIdSchema,
  emailSchema,
  loginSchema,
  productIndexSchema,
  productUpdateSchema,
  photoInsertSchema,
  stickerSheetGenerateSchema,
  stickerSelectionPrintSchema,
  stickerPresetSchema,
  STICKER_PRESETS,
  type LoginInput,
  type ProductIndexInput,
  type ProductIndexData,
  type ProductUpdateInput,
  type PhotoInsertInput,
  type StickerSheetGenerateInput,
  type StickerSheetGenerateData,
  type StickerSelectionPrintInput,
  type StickerSelectionPrintData,
  type StickerPreset,
} from "./schemas";

export {
  sanitizeForLLM,
  isSafeInboxPath,
  sanitizeAll,
} from "./security";

export type { Database, Json } from "./database.types";
export { Constants } from "./database.types";
