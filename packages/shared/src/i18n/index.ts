import { nl, type Messages } from "./nl";
import { en } from "./en";
import { de } from "./de";
import { fr } from "./fr";

export type { Messages };

export const LOCALES = ["nl", "en", "de", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "nl";

export const MESSAGES: Record<Locale, Messages> = { nl, en, de, fr };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getMessages(locale: string): Messages {
  return isLocale(locale) ? MESSAGES[locale] : MESSAGES[DEFAULT_LOCALE];
}

// BCP-47 tag per locale voor Intl-formattering (datums, getallen) en
// spraakherkenning. Eén bron van waarheid zodat schermen niet elk hun eigen
// "nl-NL" hardcoderen.
const LOCALE_TAGS: Record<Locale, string> = {
  nl: "nl-NL",
  en: "en-GB",
  de: "de-DE",
  fr: "fr-FR",
};

export function localeTag(locale: string): string {
  return isLocale(locale) ? LOCALE_TAGS[locale] : LOCALE_TAGS[DEFAULT_LOCALE];
}
