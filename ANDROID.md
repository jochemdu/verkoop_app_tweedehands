# Android — bouwen & verspreiden (voor jou + vrienden)

Doelplatform is Android. De app draait op **Expo SDK 57 / React Native 0.86**,
die standaard compileert tegen **Android 16 (API 36)**. Dat is bewust — richt
je *niet* op Android 15:

- Google Play eist voor updates al API 35+, en schuift jaarlijks op (36 volgt).
- "Laatste features" (edge-to-edge UI, predictive back, camera-verbeteringen)
  zitten aan de target die Expo al levert — geen configuratie nodig.
- De **minimum** SDK blijft Expo's default (API 24 ≈ Android 7): dekt vrijwel
  alle actieve toestellen. Niet verhogen zonder reden.

Kort: de Android-versie is een build-en-verspreid-vraag, geen versie-vraag.
Expo SDK-upgrades (via `npx expo install expo@latest` + `--fix`) houden de
target automatisch actueel.

## Eénmalige setup

```bash
npm install -g eas-cli
cd apps/mobile
eas login            # gratis Expo account
eas init             # vult expo.extra.eas.projectId in app.json
```

## Development build (voor jezelf, met native modules)

De capture-tab gebruikt expo-camera + ML Kit OCR — die werken niet in Expo Go.

```bash
eas build --profile development --platform android
# → installeer de .apk, daarna: pnpm dev:mobile (Metro + dev client)
```

## Verspreiden naar vrienden

Twee routes, van licht naar netjes:

1. **Directe APK** (snelst): 
   ```bash
   eas build --profile preview --platform android
   ```
   Deel de build-URL uit de output; vrienden installeren de .apk direct
   ("onbekende bronnen" toestaan). Prima voor 2-5 testers.

2. **Play Console → Internal testing** (aanrader zodra het serieus wordt):
   - Eenmalig $25 Google Play developer account
   - `eas build --profile production --platform android` (maakt een .aab)
   - `eas submit --platform android`
   - Voeg vrienden toe als testers (max 100), updates rollen vanzelf uit.

3. **EAS Update** (optioneel, bij 1 of 2): JS-wijzigingen over-the-air pushen
   zonder nieuwe build/review:
   ```bash
   eas update --branch preview --message "fix: ..."
   ```

Vergeet niet: elke vriend logt in met z'n eigen magic-link account — de app
is multi-tenant (fase 21), dus iedereen ziet alleen z'n eigen spullen.

## UI-vertaling (i18n)

De advertentietaal is al instelbaar (fase 23, `/settings`). De **weergavetaal**
van de app zelf is opgezet in fase 35:

| Stap | Wat | Status |
|---|---|---|
| 1 | Message-catalogs in `packages/shared/src/i18n/{nl,en,de,fr}.ts` (nl = bron) | ✅ opgezet |
| 2 | Web: `next-intl` provider + `useTranslations()` | ✅ bedraad; nav/login/settings om |
| 3 | Locale uit `profiles.display_language` → `locale`-cookie (geen URL-routing) | ✅ |
| 4 | Resterende ~35 schermen: strings naar de catalog + `t()` | ⏳ mechanische follow-up |
| 5 | Mobile: zelfde catalogs via `i18next` + `expo-localization` | ⏳ later |

**Patroon voor een nieuw scherm:** voeg de strings toe aan de `nl`-catalog (+
en/de/fr), en gebruik in het component `useTranslations("<namespace>")` (client)
of `getTranslations` (server). Wisselen van taal gebeurt via `/settings` →
Weergavetaal (zet de `locale`-cookie en herrendert direct).
