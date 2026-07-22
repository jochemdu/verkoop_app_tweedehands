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
  sanitizeIlikeQuery,
  sanitizeAll,
} from "./security";

export {
  productIdentifierColumn,
  resolveProductId,
  resolveProductIds,
  softDeleteProducts,
  restoreProducts,
  hardDeleteProducts,
  signedPhotoUrls,
  type Db,
} from "./repo";

export {
  lookupEan,
  lookupBook,
  type EanLookupResult,
  type BookLookupResult,
} from "./lookups";

export type { Database, Json } from "./database.types";
export { Constants } from "./database.types";

export {
  LOCALES,
  DEFAULT_LOCALE,
  MESSAGES,
  isLocale,
  getMessages,
  localeTag,
  type Locale,
  type Messages,
} from "./i18n";

export {
  insertProductWithPhotos,
  type InsertProductWithPhotosOptions,
  type InsertProductWithPhotosResult,
} from "./products";

export { padSticker, stickerRange } from "./sticker";

export {
  SHIPPING_CLASSES,
  SHIPPING_RATES,
  suggestShippingClass,
  estimateShipping,
  type ShippingClass,
  type ShippingEstimate,
} from "./shipping";

export {
  PRODUCT_STATUS_TONE,
  productStatusTone,
  type StatusTone,
} from "./status";
