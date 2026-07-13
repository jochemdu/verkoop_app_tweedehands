import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  getMessages,
  isLocale,
  type Locale,
} from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";

// Locale zonder URL-routing (fase 35): we lezen de gekozen taal primair uit een
// `locale`-cookie die bij het opslaan van de instellingen wordt gezet. Ontbreekt
// die cookie (vers apparaat/browser, of taal gewijzigd in de mobiele app), dan
// vallen we terug op profiles.display_language zodat de voorkeur cross-device
// klopt. Default: Nederlands.
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get("locale")?.value;
  if (isLocale(cookieLocale)) {
    return { locale: cookieLocale, messages: getMessages(cookieLocale) };
  }

  let locale: Locale = DEFAULT_LOCALE;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("display_language")
        .eq("id", user.id)
        .maybeSingle();
      if (isLocale(data?.display_language)) locale = data.display_language;
    }
  } catch {
    // Geen sessie of DB-fout: houd de default aan.
  }

  return { locale, messages: getMessages(locale) };
});
