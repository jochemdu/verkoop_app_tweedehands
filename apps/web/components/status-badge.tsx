"use client";

import { useTranslations } from "next-intl";
import {
  productStatusTone,
  listingStatusTone,
  type StatusTone,
} from "@verkoopassistent/shared";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "badge-neutral",
  accent: "badge-accent",
  info: "badge-info",
  warn: "badge-warn",
  success: "badge-success",
  danger: "badge-danger",
};

// Eén status-badge voor de hele app: vertaald label + tone-kleur uit de
// gedeelde productStatusTone (packages/shared/src/status.ts).
export function StatusBadge({
  status,
  className = "",
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const t = useTranslations("productStatus");
  if (!status) return null;
  const label = t.has(status) ? t(status) : status;
  return (
    <span className={`badge ${TONE_CLASS[productStatusTone(status)]} ${className}`}>
      {label}
    </span>
  );
}

// Advertentie-status (eigen enum + eigen labels in de "listings" st_*-namespace).
export function ListingStatusBadge({
  status,
  className = "",
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const t = useTranslations("listings");
  if (!status) return null;
  const key = `st_${status}`;
  const label = t.has(key) ? t(key) : status;
  return (
    <span className={`badge ${TONE_CLASS[listingStatusTone(status)]} ${className}`}>
      {label}
    </span>
  );
}
