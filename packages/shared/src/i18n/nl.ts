// Bron-catalog (fase 35). Nederlands is de source of truth; en/de/fr
// implementeren hetzelfde type. Gedeeld door web (next-intl) en later mobile
// (i18next). Nieuwe schermen voegen hun eigen sleutel-namespace toe.
export const nl = {
  langName: {
    nl: "Nederlands",
    en: "Engels",
    de: "Duits",
    fr: "Frans",
  },
  nav: {
    dashboard: "Dashboard",
    inventory: "Inventaris",
    listings: "Advertenties",
    suggestions: "Suggesties",
    taxatie: "Taxatie",
    upload: "Bulk upload",
    stickers: "Stickers",
    settings: "Instellingen",
    logout: "Uitloggen",
  },
  common: {
    save: "Opslaan",
    saving: "Opslaan…",
    cancel: "Annuleren",
    delete: "Verwijderen",
    back: "Terug",
    loading: "Laden…",
    search: "Zoeken",
    filter: "Filter",
    reset: "Reset",
    saved: "Opgeslagen",
  },
  login: {
    title: "VerkoopAssistent",
    subtitle: "Log in met een magic link in je inbox.",
    email: "E-mailadres",
    emailPlaceholder: "jij@voorbeeld.nl",
    sendMagicLink: "Stuur inlogmail",
    sending: "Versturen…",
    or: "of",
    google: "Log in met Google",
    checkInbox:
      "Check je inbox: klik de magic link, of vul hieronder de 6-cijferige code uit de mail in.",
    code: "Inlogcode",
    loginWithCode: "Log in met code",
    checking: "Controleren…",
    otherEmail: "Ander e-mailadres / opnieuw versturen",
  },
  settings: {
    title: "Instellingen",
    displayName: "Weergavenaam",
    displayNamePlaceholder: "Bijv. Jochem",
    displayLanguage: "Weergavetaal (app)",
    displayLanguageHelp:
      "De taal van de app-interface. Wordt direct toegepast na opslaan.",
    listingLanguage: "Advertentietaal (AI)",
    listingLanguageHelp: "De AI schrijft titels en verkoopteksten in deze taal.",
    loginMethods: "Login-methodes",
    loginMethodsHelp:
      "Koppel meerdere manieren om in te loggen aan dit ene account.",
    linkGoogle: "Koppel Google-account",
  },
};

// Bewust géén `as const`: de leaf-waarden zijn `string` zodat vertalingen
// vrij ingevuld kunnen worden; de sleutel-namen blijven wél getypt.
export type Messages = typeof nl;
