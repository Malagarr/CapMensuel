# Budget Foyer

Application web de gestion du budget personnel et familial. Suivez vos revenus,
vos dépenses et votre reste à vivre, importez vos relevés bancaires et partagez
le budget avec les membres de votre foyer.

Installable sur ordinateur, tablette, Android et iPhone au format PWA.

---

## État d'avancement

Le développement suit les 20 étapes définies dans le cahier des charges.

| # | Étape | État |
|---|-------|------|
| 1 | Initialisation du projet | ✅ terminé |
| 2 | Base de données et sécurité RLS | ✅ terminé |
| 3 | Authentification | ✅ terminé |
| 4 | Gestion des foyers | ✅ terminé |
| 5 | Comptes bancaires | ✅ terminé |
| 6 | Catégories | ✅ terminé |
| 7 | Opérations manuelles | ✅ terminé |
| 8 | Opérations récurrentes | ✅ terminé |
| 9-10 | Import CSV et Excel | ✅ terminé (assistant en 5 écrans, CSV et XLSX) |
| 11 | Détection des doublons | ✅ terminé |
| 12 | Moteur de catégorisation | ✅ terminé |
| 13 | Tableau de bord | ✅ terminé (vérifié en direct contre Supabase) |
| 14 | Budgets par catégorie | ✅ terminé |
| 15 | Prévisions de fin de mois | ✅ terminé |
| 16 | Statistiques | ✅ terminé |
| 17 | PWA | ✅ terminé |
| 18 | Sécurité et RGPD | ✅ terminé |
| 19 | Tests, données de démo | ✅ terminé (174 tests unitaires, `supabase/seed-demo.sql`) |
| 20 | Documentation et déploiement | ✅ terminé (guide de déploiement Vercel ci-dessous) |

La navigation complète du §23 (barre latérale sur ordinateur, barre du bas sur
mobile avec bouton « Ajouter » central) est en place depuis l'étape 13.

Le tableau de bord (reste à vivre, reste disponible, prévision de fin de mois)
a été vérifié en direct contre une base Supabase réelle avec le jeu de
données du §4 du cahier des charges (revenus 3 500 €, charges fixes 1 800 €,
dépenses variables 700 €, dépenses exceptionnelles 200 €, épargne 300 €) :
les valeurs affichées correspondent exactement à l'exemple attendu
(reste à vivre 1 700 €, reste disponible 500 €).

**PWA (§17)** : manifeste (`/manifest.webmanifest`), icônes générées à la
volée (favicon, icône Apple, icônes 192/512 standards et « maskable »),
service worker (`public/sw.js`, page de secours `/offline`) mis en cache
uniquement pour les fichiers statiques versionnés de Next — jamais pour les
pages ou les appels réseau, afin qu'aucune donnée financière périmée ne soit
jamais servie hors ligne comme si elle était à jour.

**Sécurité et RGPD (§18)** : Content-Security-Policy restrictive (`connect-src`
limité à l'origine exacte du projet Supabase), page « Confidentialité »
(`/confidentialite`) avec export complet des données au format JSON et
suppression de compte (avec confirmation explicite). La suppression a été
vérifiée par relecture du code et par test du chemin de validation (refus
d'une confirmation incorrecte) ; le chemin de suppression réelle n'a
volontairement pas été testé de bout en bout en production faute d'un compte
jetable disponible — à tester avec un compte de test avant mise en production.

---

## Technologies

| Rôle | Choix |
|------|-------|
| Cadre applicatif | Next.js 15 (App Router) |
| Interface | React 19, TypeScript, Tailwind CSS 4 |
| Base de données | PostgreSQL via Supabase |
| Authentification | Supabase Auth |
| Graphiques | Recharts |
| Lecture CSV | Papa Parse (dans le navigateur) |
| Lecture Excel | ExcelJS (dans le navigateur, import dynamique) |
| Validation | Zod, côté client **et** côté serveur |
| Tests | Vitest |
| Hébergement visé | Vercel |

---

## Installation

### Prérequis

- Node.js 20.9 ou plus récent
- Un compte Supabase (l'offre gratuite suffit)

### 1. Installer les dépendances

```bash
npm install
```

### 2. Créer le projet Supabase

1. Ouvrez [supabase.com](https://supabase.com) et créez un projet.
2. Choisissez une région proche de vos utilisateurs (par exemple *Europe West*).
3. Notez le mot de passe de la base de données : il n'est affiché qu'une fois.

### 3. Appliquer les migrations

Dans le tableau de bord Supabase, ouvrez **SQL Editor** puis exécutez, **dans
l'ordre**, le contenu de chaque fichier du dossier `supabase/migrations/` :

1. `20260801000001_schema.sql` — types, tables et contraintes
2. `20260801000002_indexes_functions_triggers.sql` — index, déclencheurs, journal d'audit
3. `20260801000003_rls.sql` — Row Level Security
4. `20260801000004_rpc_and_views.sql` — fonctions métier et vues
5. `20260801000005_storage.sql` — compartiments de fichiers *(facultatif, voir ci-dessous)*

> L'ordre compte : chaque fichier s'appuie sur les objets créés par le précédent.
> Collez le contenu **entier** d'un fichier, puis *Run*. N'exécutez pas les
> instructions une par une.

Si vous utilisez la CLI Supabase avec Docker, `supabase db push` applique
l'ensemble en une commande.

#### En cas d'erreur

Supabase affiche parfois un avertissement **« Potential issue detected — this
query creates tables without enabling Row Level Security »** :

- sur la **migration 1**, choisissez *Run and enable RLS* : les tables sont
  protégées immédiatement, sans attendre la migration 3 ;
- sur les **migrations 2 à 5**, c'est un faux positif (elles ne créent aucune
  table) : choisissez *Run without RLS*.

| Message | Cause | Que faire |
|---------|-------|-----------|
| `must be owner of table objects` | Migration 5 : sur certains projets, `storage.objects` appartient à `supabase_storage_admin`, pas à `postgres`. | **Passez cette migration.** Elle ne concerne que les photos de profil et les justificatifs, dont aucune étape avant la 12 n'a besoin. |
| `type "member_role" already exists` | La migration 1 a déjà été exécutée, au moins partiellement. | Ne la rejouez pas. Passez à la suivante. Pour repartir de zéro : *Settings → General → Reset database*. |
| `relation "households" does not exist` | Les fichiers ont été exécutés dans le désordre. | Reprenez à la migration 1, dans l'ordre numérique. |
| `permission denied for schema auth` | Migration 2, déclencheur sur `auth.users`. | Vérifiez que vous êtes bien dans le SQL Editor du tableau de bord, et non connecté avec un rôle restreint. |

Après la migration 5, ce contrôle récapitule l'état de la base. Les valeurs
attendues sont indiquées en commentaire.

```sql
select
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE') as nb_tables,        -- 18
  (select count(*) from pg_policies where schemaname = 'public') as nb_politiques_rls, -- 63
  (select count(*) from storage.buckets) as nb_compartiments,                          -- 2
  (select count(*) from pg_tables
     where schemaname = 'public' and rowsecurity = false) as tables_sans_rls;          -- 0
```

`tables_sans_rls` est le contrôle le plus important : il doit valoir **0**.
Toute table qui y figurerait serait accessible sans restriction.

### 4. Configurer les variables d'environnement

Copiez `.env.example` en `.env.local` :

```bash
cp .env.example .env.local
```

Les valeurs se trouvent dans le tableau de bord Supabase, engrenage **Project
Settings → API Keys**.

Supabase a changé le format de ses clés : selon l'âge de votre projet, vous
verrez l'une ou l'autre génération. **Les deux fonctionnent** — prenez celles
que votre tableau de bord affiche.

| Variable | Génération actuelle | Ancienne génération | Exposée au navigateur |
|----------|---------------------|---------------------|----------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | *Data API* → Project URL | idem | oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *Publishable key* → `sb_publishable_…` | *anon public* → `eyJhbGciOi…` | oui |
| `SUPABASE_SERVICE_ROLE_KEY` | *Secret keys* → `sb_secret_…` | *service_role* → `eyJhbGciOi…` | **non, jamais** |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` en développement | idem | oui |

> Les anciennes clés `anon` / `service_role` peuvent être masquées derrière un
> onglet **Legacy API keys** sur les projets récents. Inutile de les chercher si
> vous avez déjà les clés `sb_…`.

> `SUPABASE_SERVICE_ROLE_KEY` n'est utilisée que par les scripts
> d'administration (données de démonstration, suppression de compte).
> L'application démarre sans : vous pouvez la renseigner plus tard.

> La clé `service_role` contourne toutes les règles de sécurité. Elle ne doit
> figurer que dans `.env.local` et dans les variables d'environnement serveur de
> Vercel, jamais dans le code ni dans un dépôt Git.

### 5. Régler l'authentification Supabase

Dans **Authentication → URL Configuration** :

- *Site URL* : `http://localhost:3000`
- *Redirect URLs* : ajoutez `http://localhost:3000/auth/confirm` et
  `http://localhost:3000/auth/callback`

Dans **Authentication → Providers → Email** :

- Activez *Confirm email* pour vérifier les adresses (§20 du cahier des charges).
- Portez *Minimum password length* à **10**, pour correspondre à la validation
  de l'application.

### 6. Lancer l'application

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

Tant que `.env.local` n'est pas rempli, l'application affiche une page
« Configuration requise » qui rappelle ces étapes, plutôt qu'une erreur.

### 7. (Optionnel) Charger des données de démonstration

`supabase/seed-demo.sql` remplit un foyer existant avec trois mois
d'opérations réalistes (salaire, loyer, courses, sorties, épargne...), pour
voir un tableau de bord parlant sans tout saisir à la main.

Ouvrez le fichier, remplacez `target_owner_email` par l'e-mail du compte
concerné, puis collez-le dans le SQL Editor Supabase et exécutez-le. Tout est
isolé dans un compte bancaire dédié (« Compte courant (démo) »), sans toucher
au reste : le script peut être relancé à volonté, il repart d'un compte de
démo vide à chaque fois. La fin du fichier indique comment tout supprimer.

---

## Commandes disponibles

| Commande | Effet |
|----------|-------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Compilation de production |
| `npm start` | Sert la compilation de production |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run lint` | Analyse statique ESLint |
| `npm test` | Tests unitaires (Vitest) |

> Ne lancez pas `npm run build` pendant que `npm run dev` tourne : les deux
> écrivent dans `.next/` et se gênent mutuellement.

---

## Structure du projet

```
.
├── src/
│   ├── app/
│   │   ├── (auth)/              Connexion, inscription, mot de passe
│   │   ├── (app)/               Pages protégées : tableau de bord, comptes,
│   │   │                        opérations, récurrentes, catégories, budgets,
│   │   │                        statistiques, foyer, import, confidentialité
│   │   ├── api/export-donnees/  Export JSON des données (§18)
│   │   ├── auth/                Routes techniques : confirmation, callback
│   │   ├── bienvenue/           Création ou adhésion à un foyer
│   │   ├── rejoindre/[code]/    Arrivée sur un lien d'invitation
│   │   ├── configuration-requise/  Page de premier lancement
│   │   ├── offline/             Page de secours du service worker (§17)
│   │   ├── icon.tsx, apple-icon.tsx, icons/  Icônes générées à la volée
│   │   ├── manifest.ts          Manifeste PWA (§17)
│   │   ├── layout.tsx           Layout racine, thème, polices
│   │   └── globals.css          Jetons de design, mode clair et sombre
│   ├── components/
│   │   └── ui/                  Composants réutilisables
│   ├── lib/
│   │   ├── actions/              Server Actions (une par domaine métier)
│   │   ├── banking/               Moteur d'analyse bancaire, pur et testé :
│   │   │                          normalisation des libellés, dates, montants,
│   │   │                          détection de colonnes, catégorisation, doublons
│   │   ├── supabase/             Clients navigateur, serveur, middleware et
│   │   │                         admin (service_role, §18)
│   │   ├── validation/           Schémas Zod
│   │   ├── dashboard.ts          Calculs du tableau de bord (§13-15), pur et testé
│   │   ├── env.ts                Lecture validée de la configuration
│   │   ├── format.ts             Montants, dates, pourcentages (français)
│   │   └── utils.ts              Utilitaires transverses
│   ├── types/
│   │   └── database.ts          Types reflétant le schéma SQL
│   └── middleware.ts            Rafraîchit la session, protège les routes
├── public/
│   └── sw.js                    Service worker (§17)
└── supabase/
    ├── migrations/              Scripts SQL, à exécuter dans l'ordre
    └── seed-demo.sql            Données de démonstration, à exécuter à la main
```

---

## Choix techniques structurants

**Montants signés.** Un montant négatif est une sortie d'argent, un montant
positif une entrée. Le solde d'un compte vaut donc `solde_initial + somme des
montants`. Un remboursement est une opération de type « dépense » avec un
montant positif : il se déduit naturellement du total de sa catégorie, sans
gonfler artificiellement les revenus.

**`numeric(14,2)`, jamais de nombre à virgule flottante.** En binaire flottant,
`0.1 + 0.2` ne donne pas `0.3`. Ce serait sans conséquence pour un affichage,
mais pas pour un solde bancaire.

**Isolation par foyer.** Toutes les tables métier portent `household_id` et sont
protégées par Row Level Security. Un utilisateur ne peut lire ou écrire que les
données des foyers dont il est membre — la règle est appliquée par PostgreSQL,
pas par le code applicatif, et reste donc vraie même si une requête est mal
écrite.

**Analyse locale des fichiers bancaires.** Les relevés CSV et Excel sont lus
dans le navigateur (Papa Parse et ExcelJS). Seules les opérations validées par
l'utilisateur sont envoyées au serveur ; le fichier lui-même ne quitte jamais
l'appareil.

**Détection de format sans configuration.** Les dates ambiguës (jour/mois vs
mois/jour) et le séparateur décimal sont déduits en observant l'ensemble d'une
colonne, pas une valeur isolée. Le format d'une banque, une fois confirmé, est
mémorisé pour les imports suivants.

---

## Déploiement (§20)

Aucune étape n'est spécifique à ce projet au-delà d'un déploiement Next.js
standard sur Vercel :

1. **Importez le dépôt** sur [vercel.com](https://vercel.com) (bouton
   « Add New… › Project », en choisissant `Malagarr/CapMensuel`). Le
   framework Next.js est détecté automatiquement.
2. **Renseignez les variables d'environnement** (Project Settings ›
   Environment Variables), les mêmes que dans `.env.local` :
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (nécessaire à la suppression de compte du
   §18) et `NEXT_PUBLIC_SITE_URL` (l'URL `https://…` que Vercel attribuera,
   à mettre à jour après le premier déploiement si vous ne connaissez pas
   encore le domaine final).
3. **Mettez à jour Supabase** (Authentication › URL Configuration) : ajoutez
   l'URL de production à « Site URL » et « Redirect URLs », sinon les liens
   envoyés par e-mail (confirmation, réinitialisation de mot de passe)
   redirigeront vers `localhost`.
4. **Vérifiez la PWA après le premier déploiement** : `/manifest.webmanifest`
   doit répondre, et un navigateur mobile doit proposer « Ajouter à l'écran
   d'accueil ». Le service worker (§17) n'a d'effet qu'en HTTPS — Vercel le
   fournit par défaut, aucune configuration supplémentaire n'est nécessaire.

Le build échoue volontairement si une erreur TypeScript ou ESLint subsiste
(voir `next.config.mjs`) : un déploiement qui aboutit garantit donc que ces
deux vérifications sont passées.

---

## Limite connue

Le format `.xls` (Excel 97-2003, binaire) n'est pas pris en charge : la seule
bibliothèque npm capable de le lire présente une faille de sécurité non
corrigée, jugée inacceptable pour analyser des relevés bancaires. Les fichiers
`.xlsx` et `.csv` couvrent la quasi-totalité des exports bancaires actuels ; un
`.xls` peut être converti en `.xlsx` depuis Excel ou LibreOffice.
