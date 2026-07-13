import { create } from "zustand";
import { createMMKV } from "react-native-mmkv";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@verkoopassistent/shared";

// Mobiele taalkeuze (fase 37). Wordt lokaal in MMKV bewaard zodat de app direct
// in de juiste taal opent, en gespiegeld vanuit profiles.display_language zodra
// er een sessie is (zie useSyncLocaleFromProfile) — consistent met de web-app.

const mmkv = createMMKV({ id: "verkoopassistent-i18n" });
const KEY = "locale";

function initialLocale(): Locale {
  const stored = mmkv.getString(KEY);
  return stored && isLocale(stored) ? stored : DEFAULT_LOCALE;
}

type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: initialLocale(),
  setLocale: (locale) => {
    mmkv.set(KEY, locale);
    set({ locale });
  },
}));
