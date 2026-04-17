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
} from "./enums.js";

export {
  stickerIdSchema,
  emailSchema,
  loginSchema,
  productIndexSchema,
  productUpdateSchema,
  photoInsertSchema,
  stickerSheetGenerateSchema,
  type LoginInput,
  type ProductIndexInput,
  type ProductIndexData,
  type ProductUpdateInput,
  type PhotoInsertInput,
  type StickerSheetGenerateInput,
  type StickerSheetGenerateData,
} from "./schemas.js";

export {
  sanitizeForLLM,
  isSafeInboxPath,
  sanitizeAll,
} from "./security.js";

export type { Database, Json } from "./database.types.js";
export { Constants } from "./database.types.js";
