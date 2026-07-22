import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Eén bron voor bedragen (fase 52): duizendtalgroepering + valuta-symbool per
// locale via Intl. Vervangt handmatige toFixed(2).replace(".", ",") door de app.
export function formatEuro(
  value: number | string | null | undefined,
  localeTag = "nl-NL",
): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat(localeTag, {
    style: "currency",
    currency: "EUR",
  }).format(Number.isFinite(n as number) ? (n as number) : 0);
}
