# Ribongrant Calendar — Mobile (React Native / Expo)

Application de calendrier autonome (données 100 % locales, hors-ligne) au design Google Calendar, pour **Android** et **iOS**, construite avec **Expo SDK 58** + **TypeScript**.

## Fonctionnalités

- Vues **Mois**, **Semaine**, **Jour** (segmented control + swipe horizontal pour changer de période)
- Vue mois façon Google Calendar : jours hors mois gris, aujourd'hui en pastille bleue, chips colorés, « +N de plus »
- Vue semaine/jour : grille horaire 00–23, bandeau « toute la ligne », ligne rouge « maintenant » mise à jour chaque minute, défilement automatique sur 7h30
- Création rapide : **tap sur un créneau horaire** (événement d'1 h à cette heure) ou **FAB +**
- Éditeur : titre, début/fin (dates + heures), toute la journée, **couleur** (palette 8), **récurrence** (quotidienne / hebdomadaire / mensuelle + date de fin), **rappel** (notification locale : au moment, 5/10/30/60 min, 1 jour avant), description
- Fiche événement (bottom sheet) : détails, Modifier, Supprimer
- **Recherche** plein écran par titre/description
- Thème **clair/sombre** automatique (identité Google : bleu #1A73E8)
- Persistance **SQLite locale** (`expo-sqlite`), interface **100 % française**

## Lancer l'application

```bash
cd mobile
npm install
npx expo start
```

Puis scanne le QR code avec l'app **Expo Go** (Android/iOS), ou appuie sur `a` pour l'émulateur Android.

### Notifications (rappels)

Les notifications locales fonctionnent dans **Expo Go sur iOS** ; sur **Android, Expo Go n'affiche pas les notifications** (limitation Expo depuis le SDK 53). Pour tester les rappels sur Android, crée un development build :

```bash
npx expo run:android
# ou : npx eas build --profile development --platform android
```

## Vérifications

```bash
npx tsc --noEmit   # typage
npx expo lint      # lint (ESLint config Expo)
npx expo export --platform android   # bundle de validation
```

## Structure

```
src/
├── app/                 # Routes expo-router
│   ├── _layout.tsx      # Providers (SQLite, notifications, thème) + Stack
│   ├── index.tsx        # Écran calendrier
│   ├── event.tsx        # Modal création/édition
│   └── search.tsx       # Modal recherche
├── components/          # MonthView, TimeView, TimeGrid, EventBlock, header, sheet…
├── domain/              # Types, dates (date-fns + fr), expansion des récurrences
├── db/database.ts       # Schéma + requêtes SQLite
├── lib/notifications.ts # Planification des rappels locaux
├── store/               # Zustand (événements, préférences)
└── theme.ts             # Thèmes clair/sombre + couleurs d'événements
```

## Notes

- `metro.config.js` isole la résolution des modules dans `mobile/node_modules` (le repo parent contient une app Electron avec ses propres `node_modules`).
- `.npmrc` force `legacy-peer-deps` (conflit peer `react-dom` transitif d'expo-router sur le web, sans impact Android/iOS).
- Les dossiers `android/` et `ios/` ne sont pas versionnés (générés par Continuous Native Generation si besoin : `npx expo prebuild`).
