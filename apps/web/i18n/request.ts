import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, getMessages, isLocale } from "@verkoopassistent/shared";

// Locale zonder URL-routing (fase 35): we lezen de gekozen taal uit een
// `locale`-cookie die bij het opslaan van de instellingen wordt gezet
// (gespiegeld aan profiles.display_language). Default: Nederlands.
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get("locale")?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  return { locale, messages: getMessages(locale) };
});
