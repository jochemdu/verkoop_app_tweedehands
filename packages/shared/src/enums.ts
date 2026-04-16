import { Constants, type Database } from "./database.types.js";

// Runtime arrays (uit Constants) — gebruik voor forms/dropdowns.
export const PRODUCT_CONDITIONS = Constants.public.Enums.product_condition;
export const PRODUCT_STATUSES = Constants.public.Enums.product_status;
export const LISTING_STATUSES = Constants.public.Enums.listing_status;
export const PHOTO_TYPES = Constants.public.Enums.photo_type;
export const STICKER_INPUT_METHODS = Constants.public.Enums.sticker_input_method;
export const PLATFORM_SLUGS = Constants.public.Enums.platform_slug;
export const BUYBACK_SERVICE_SLUGS = Constants.public.Enums.buyback_service_slug;
export const CATEGORY_SLUGS = Constants.public.Enums.category_slug;
export const BUNDLE_TYPES = Constants.public.Enums.bundle_type;

// Type aliases — gebruik voor function signatures en props.
export type ProductCondition = Database["public"]["Enums"]["product_condition"];
export type ProductStatus = Database["public"]["Enums"]["product_status"];
export type ListingStatus = Database["public"]["Enums"]["listing_status"];
export type PhotoType = Database["public"]["Enums"]["photo_type"];
export type StickerInputMethod = Database["public"]["Enums"]["sticker_input_method"];
export type PlatformSlug = Database["public"]["Enums"]["platform_slug"];
export type BuybackServiceSlug = Database["public"]["Enums"]["buyback_service_slug"];
export type CategorySlug = Database["public"]["Enums"]["category_slug"];
export type BundleType = Database["public"]["Enums"]["bundle_type"];
