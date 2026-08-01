# Budget Foyer

Application PWA de gestion de budget personnel et familial. Interface, commentaires
et messages de commit sont en français.

## Installation

Prérequis : Node.js ≥ 20.9, un projet [Supabase](https://supabase.com).

```bash
npm install
cp .env.example .env.local   # renseignez les 4 valeurs, voir le fichier pour le détail
npm run dev
```

Les migrations SQL du dossier `supabase/migrations/` créent le schéma complet
(tables, index, déclencheurs, politiques RLS, vues et fonctions RPC) : à appliquer
sur le projet Supabase via le CLI (`supabase db push`) ou l'éditeur SQL du tableau
de bord, dans l'ordre numérique des fichiers.

Commandes de vérification (doivent rester vertes) :

```bash
npx tsc --noEmit   # typage strict
npm run lint       # ESLint
npm test           # Vitest
npm run build      # build de production Next.js
```

## Choix techniques structurants

- **Next.js 15 / React 19 / TypeScript strict / Tailwind 4.** Server Actions pour
  toutes les écritures, validées côté serveur avec Zod même quand le client a
  déjà validé (jamais de confiance aveugle dans les données reçues).
- **Supabase / PostgreSQL.** L'isolation entre foyers est appliquée par la Row
  Level Security de PostgreSQL, pas par le code applicatif : même un bug côté
  serveur ne peut pas faire fuiter les données d'un autre foyer. Le rôle
  « lecture seule » (`viewer`) est réalisé en excluant ce rôle des politiques
  INSERT/UPDATE/DELETE.
- **Montants signés, jamais de virgule flottante pour l'argent.** Négatif =
  sortie d'argent, positif = entrée. Stockés en `numeric(14,2)`, arrondis au
  centime à chaque calcul.
- **Fichiers bancaires analysés dans le navigateur, jamais téléversés.** CSV via
  Papa Parse (import statique, bibliothèque légère), Excel via ExcelJS (import
  dynamique, pour ne pas alourdir le paquet initial pour les visiteurs qui ne
  font jamais d'import). Le format `.xls` binaire n'est pas pris en charge :
  la seule bibliothèque npm capable de le lire porte une faille de sécurité non
  corrigée.
- **Moteur d'analyse bancaire en fonctions pures** (`src/lib/banking/`), testées
  indépendamment de toute base de données ou requête réseau : normalisation des
  libellés, analyse des dates (ordre jour/mois déduit de la colonne entière) et
  des montants (sept écritures bancaires différentes), détection des colonnes
  et empreinte de format par banque, catégorisation à hiérarchie de confiance,
  détection de doublons (base existante et doublons internes au fichier).
- **Suppressions et mises à jour Server Actions vérifiées.** `.delete().select()`
  ou `.update().select()` suivi d'un contrôle du nombre de lignes affectées :
  la Row Level Security bloque silencieusement les écritures non autorisées,
  sans lever d'erreur réseau.

## Avancement

Progression du cahier des charges en 20 étapes. Les étapes 17 à 20 restent à
préciser une fois les étapes 13 à 16 posées : leur intitulé ci-dessous est une
estimation d'après le schéma de base de données déjà en place (tables
`savings_goals`, `notifications`), pas une certitude.

| # | Étape | État |
|---|-------|------|
| 1 | Socle Next.js (sécurité, en-têtes, structure du projet) | ✅ Terminée |
| 2 | Schéma Supabase (18 tables, RLS, index, audit) | ✅ Terminée |
| 3 | Authentification e-mail, protection des routes | ✅ Terminée |
| 4 | Foyers, invitations par code, rôles admin/membre/lecture seule | ✅ Terminée |
| 5 | Comptes bancaires, soldes constaté et théorique | ✅ Terminée |
| 6 | Catégories personnalisables (sous-catégories sur un niveau) | ✅ Terminée |
| 7 | Opérations manuelles, virements internes liés | ✅ Terminée |
| 8 | Opérations récurrentes, préparation automatique des échéances | ✅ Terminée |
| 9 | Assistant d'import en 5 écrans (`/import`) | ✅ Terminée |
| 10 | Règles de catégorisation (`/regles`) : créer, modifier, désactiver, appliquer aux anciennes opérations | ✅ Terminée |
| 11 | Détection de doublons (base existante et fichier lui-même) | ✅ Terminée |
| 12 | Mémorisation du format d'import par banque (`import_profiles`) | ✅ Terminée |
| 13 | Tableau de bord, navigation §23 (barre latérale / barre du bas mobile) | ⬜ À faire |
| 14 | Budgets par catégorie | ⬜ À faire |
| 15 | Prévision de fin de mois | ⬜ À faire |
| 16 | Statistiques | ⬜ À faire |
| 17 | Objectifs d'épargne *(à confirmer)* | ⬜ À faire |
| 18 | Notifications *(à confirmer)* | ⬜ À faire |
| 19 | Export et rapports *(à confirmer)* | ⬜ À faire |
| 20 | PWA : manifeste, service worker, installation hors-ligne *(à confirmer)* | ⬜ À faire |

### Moteur bancaire et assistant d'import (étapes 9 à 12) — détail

- `src/lib/banking/` : lecture CSV/XLSX dans le navigateur, détection des
  colonnes et du format, analyse des dates et montants, catégorisation par
  hiérarchie de confiance, détection de doublons. Fonctions pures, 136 tests
  unitaires.
- `src/lib/actions/import.ts` : chargement du contexte de catégorisation,
  recherche et enregistrement du profil d'import par empreinte d'en-tête,
  validation finale (recalcul serveur des champs dérivés, apprentissage des
  corrections de commerçant).
- `src/app/(app)/import/` : assistant en 5 écrans — dépôt du fichier avec
  glisser-déposer et choix du compte, analyse automatique, correspondance
  manuelle des colonnes si incertaine, aperçu ligne à ligne avec récapitulatif
  (total, nouvelles, doublons, à vérifier, ignorées), validation finale.
- `src/lib/actions/rule.ts` et `src/app/(app)/regles/` : gestion des règles de
  catégorisation, portée compte ou foyer, application rétroactive limitée aux
  opérations encore sans catégorie (une opération déjà classée à la main n'est
  jamais écrasée silencieusement).

La navigation complète du §23 (barre latérale sur ordinateur, barre du bas sur
mobile avec bouton « Ajouter » central) n'est pas encore posée : l'en-tête
horizontal actuel (`src/app/(app)/layout.tsx`) porte désormais 8 liens et sera
remplacé à l'étape 13, comme prévu depuis l'étape 8.
