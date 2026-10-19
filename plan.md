# Plan — App React Native "Ribongrant Calendar" (style Google Calendar)

## Objectif
Créer dans `Z:\Projets\ribongrant_calendar\mobile\` une app **Expo React Native** autonome (données locales), design **Material 3 façon Google Calendar**, Android principal + iOS possible via le même codebase. Fonctions : vues **mois / semaine / jour**, création par tap sur créneau, récurrence, couleurs, rappels (notifications locales), recherche, thème clair/sombre.

## Choix techniques
- **Expo SDK courant + TypeScript**, routage **expo-router** (modals natifs).
- **Stockage** : `expo-sqlite` (base locale, requêtes par plage de dates).
- **État** : Zustand (store unique, persistance via SQLite, rechargement à chaque mutation).
- **UI** : composants maison (pas de lib de calendrier — pour coller au design Google) + primitives Material 3 ; `react-native-paper` pour dialogs/FAB/snackbars.
- **Animations/gestes** : `react-native-gesture-handler` + `react-native-reanimated` (swipe horizontal = période suivante/précédente).
- **Dates** : `date-fns` (+ locale `fr`).
- **Notifications** : `expo-notifications` (planification locale à l'échéance − offset rappel). ⚠️ Android : les notifications locales nécessitent un **dev build** (pas Expo Go SDK 53+) — l'UI de rappel fonctionnera partout, le déclenchement sera testable en dev build ; documenter dans le README mobile.
- **Hors-ligne pur** : aucune dépendance réseau.

## Structure cible
```
mobile/
├── app/                      # expo-router
│   ├── _layout.tsx           # providers (Paper, safe area, store init, thème)
│   ├── index.tsx             # écran Calendrier (header + vue active + FAB)
│   ├── event.tsx             # modal création/édition d'événement
│   └── search.tsx            # modal recherche
├── src/
│   ├── db/                   # expo-sqlite : schéma, migrations, requêtes events
│   ├── domain/
│   │   ├── types.ts          # Event { id, title, description, start, end, allDay, color, recurrence, recurrenceUntil, reminderMinutes }
│   │   ├── recurrence.ts     # expansion des récurrences (daily/weekly/monthly + until, garde-fous)
│   │   └── dates.ts          # helpers semaine ISO, plages, formatage FR
│   ├── store/eventsStore.ts  # Zustand : CRUD + ensureRange(start,end) + search
│   ├── theme.ts              # palette Material 3 (clair/sombre), couleurs événements (7)
│   └── components/
│       ├── CalendarHeader.tsx    # titre période, ◀ ▶, "Aujourd'hui", switcher de vue
│       ├── MonthView.tsx         # grille 7×N, chips par jour, "today" en bleu, weekend gris
│       ├── TimeGrid.tsx          # colonne heures 00–23, lignes, now-line rouge
│       ├── WeekView.tsx          # TimeGrid + chips événements positionnés
│       ├── DayView.tsx           # idem jour, plus détaillé
│       ├── EventBlock.tsx        # bloc coloré, chevauchements côte à côte
│       └── EventSheet.tsx        # détail rapide (tap sur événement) → Modifier / Supprimer
├── app.json / package.json / tsconfig.json / README.md
```

## UX (calque Google Calendar)
- **Header** : titre période (« Octobre 2026 »), flèches, bouton = aujourd'hui, segmented control Mois/Semaine/Jour.
- **Mois** : grille 6 semaines, jours hors mois en gris, aujourd'hui = pastille bleue, chips colorés max 2–3 + « +N », tap jour → vue jour.
- **Semaine/Jour** : time-grid défilant (auto-scroll vers 8h), tap sur un créneau = crée un événement à cette heure (durée 1h par défaut), now-line rouge, swipe horizontal = semaine suivante.
- **FAB** bleu « + » → modal éditeur.
- **Éditeur** : titre, début/fin (date + heure), toute la journée, couleur (palette Material), récurrence (aucune/quotidienne/hebdomadaire/mensuelle + date de fin), rappel (aucun/au moment/5/10/30/60 min avant), description ; validation, suppression en mode édition.
- **Recherche** : modal plein écran, filtre par titre/description, résultat → ouvre l'événement.
- **Thème** : clair par défaut (identité Google : fond blanc, bleu #1A73E8), sombre automatique.
- Interface **100 % française**.

## Étapes d'implémentation
1. **Scaffold** : `npx create-expo-app@latest mobile` (template TypeScript), installer deps (expo-sqlite, expo-notifications, zustand, date-fns, paper, gesture-handler, reanimated, safe-area-context), config Babel/Metro, `app.json` (nom, android.package `fr.ribongrant.calendar`, plugins expo-router/notifications).
2. **Domaine + DB** : schéma SQLite `events`, helpers dates/récurrence, store Zustand avec `ensureRange` (charge la plage visible).
3. **Shell écran calendrier** : header + navigation période + switcher de vue + FAB.
4. **MonthView** puis **WeekView/DayView** (TimeGrid partagé, EventBlock avec chevauchements).
5. **Éditeur événement** (modal) + **EventSheet** détail/suppression.
6. **Recherche**, **notifications locales**, **thème sombre**.
7. **Vérification** : `npx tsc --noEmit`, lint, `npx expo export --platform android` pour valider le bundle ; README avec instructions de lancement.

## Hors périmètre (conformément aux réponses)
- Pas de backend / sync / comptes.
- Pas de fonctionnalités équipe (membres, disponibilités, missions) — restent dans l'app Electron existante.

## Risques / validations
- Pas d'émulateur Android garanti ici : validation finale (rendu + gestes) par l'utilisateur via **Expo Go** (aperçu) puis dev build.
- Notifications : limitées dans Expo Go → documenté, non bloquant.
- Création par drag sur time-grid : Reanimated + Gesture Handler ; fallback tap simple si le geste pose problème.
