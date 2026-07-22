import type { ProductStatus, ListingStatus } from "./enums";

// Eén bron voor status-kleur (tone) over alle schermen. De labels leven in de
// i18n-catalogs (namespace "productStatus" resp. "listings" st_*); de tone mapt
// op de badge-tone utilities in globals.css
// (badge-neutral/accent/info/warn/success/danger).
export type StatusTone =
  | "neutral"
  | "accent"
  | "info"
  | "warn"
  | "success"
  | "danger";

export const PRODUCT_STATUS_TONE: Record<ProductStatus, StatusTone> = {
  indexed: "neutral",
  analyzing: "info",
  ready_to_list: "accent",
  pending_review: "warn",
  approved: "info",
  listed: "accent",
  sold: "success",
  archived: "neutral",
};

export function productStatusTone(
  status: string | null | undefined,
): StatusTone {
  return status && status in PRODUCT_STATUS_TONE
    ? PRODUCT_STATUS_TONE[status as ProductStatus]
    : "neutral";
}

export const LISTING_STATUS_TONE: Record<ListingStatus, StatusTone> = {
  draft: "neutral",
  pending_review: "warn",
  approved: "info",
  publishing: "info",
  published: "accent",
  sold: "success",
  expired: "neutral",
  error: "danger",
};

export function listingStatusTone(
  status: string | null | undefined,
): StatusTone {
  return status && status in LISTING_STATUS_TONE
    ? LISTING_STATUS_TONE[status as ListingStatus]
    : "neutral";
}
