import type { Messages } from "./nl";

export const fr: Messages = {
  langName: {
    nl: "Néerlandais",
    en: "Anglais",
    de: "Allemand",
    fr: "Français",
  },
  nav: {
    dashboard: "Tableau de bord",
    inventory: "Inventaire",
    listings: "Annonces",
    suggestions: "Suggestions",
    taxatie: "Estimation",
    upload: "Import groupé",
    stickers: "Étiquettes",
    settings: "Paramètres",
    logout: "Se déconnecter",
  },
  common: {
    save: "Enregistrer",
    saving: "Enregistrement…",
    cancel: "Annuler",
    delete: "Supprimer",
    back: "Retour",
    loading: "Chargement…",
    search: "Rechercher",
    filter: "Filtrer",
    reset: "Réinitialiser",
    saved: "Enregistré",
  },
  login: {
    title: "VerkoopAssistent",
    subtitle: "Connecte-toi avec un lien magique dans ta boîte mail.",
    email: "Adresse e-mail",
    emailPlaceholder: "toi@exemple.fr",
    sendMagicLink: "Envoyer l’e-mail de connexion",
    sending: "Envoi…",
    or: "ou",
    google: "Se connecter avec Google",
    checkInbox:
      "Vérifie ta boîte mail : clique le lien magique, ou saisis ci-dessous le code à 6 chiffres reçu par e-mail.",
    code: "Code de connexion",
    loginWithCode: "Se connecter avec le code",
    checking: "Vérification…",
    otherEmail: "Autre e-mail / renvoyer",
  },
  settings: {
    title: "Paramètres",
    displayName: "Nom affiché",
    displayNamePlaceholder: "Ex. Jochem",
    displayLanguage: "Langue d’affichage (app)",
    displayLanguageHelp:
      "La langue de l’interface. Appliquée immédiatement après enregistrement.",
    listingLanguage: "Langue des annonces (IA)",
    listingLanguageHelp:
      "L’IA rédige les titres et textes de vente dans cette langue.",
    loginMethods: "Méthodes de connexion",
    loginMethodsHelp:
      "Associe plusieurs façons de se connecter à ce même compte.",
    linkGoogle: "Associer un compte Google",
  },
};
