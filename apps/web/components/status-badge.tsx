"use client";

import { useTranslations } from "next-intl";
import { productStatusTone, type StatusTone } from "@verkoopassistent/shared";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "badge-neutral",
  accent: "badge-accent",
  info: "badge-info",
  warn: "badge-warn",
  success: "badge-success",
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
