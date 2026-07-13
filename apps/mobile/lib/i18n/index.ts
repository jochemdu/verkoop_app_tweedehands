import { useCallback, useEffect } from "react";
import {
  getMessages,
  isLocale,
  type Locale,
  type Messages,
} from "@verkoopassistent/shared";
import { supabase } from "@/lib/supabase";
import { useLocaleStore } from "./store";

// Lichtgewicht i18n voor de Expo-app (fase 37). Hergebruikt exact dezelfde
// gedeelde catalogs als de web-app. De mobiele namespace gebruikt bewust simpele
// {var}-interpolatie (geen ICU), zodat we geen extra runtime nodig hebben.

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}

export function useSetLocale() {
  return useLocaleStore((s) => s.setLocale);
}

/**
 * Vertaal-hook voor één namespace. Retourneert een `t(key, vars?)`-functie die
 * de string uit de actieve locale opzoekt en {var}-placeholders invult.
 */
export function useTranslation<N extends keyof Messages>(namespace: N) {
  const locale = useLocaleStore((s) => s.locale);
  const messages = getMessages(locale)[namespace] as Record<string, string>;
  return useCallback(
    (key: keyof Messages[N] & string, vars?: Vars): string => {
      const template = messages[key];
      return typeof template === "string" ? interpolate(template, vars) : key;
    },
    [messages],
  );
}

/**
 * Spiegelt de taal uit profiles.display_language naar de lokale store zodra er
 * een sessie is. Zo volgt de app automatisch de op de web-app gekozen taal.
 */
export function useSyncLocaleFromProfile(userId: string | undefined) {
  const setLocale = useLocaleStore((s) => s.setLocale);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("display_language")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const lang = data?.display_language;
        if (!cancelled && lang && isLocale(lang)) setLocale(lang);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, setLocale]);
}
