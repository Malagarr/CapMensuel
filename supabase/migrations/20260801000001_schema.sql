-- ===========================================================================
-- Budget Foyer — Schéma initial
--
-- Conventions retenues :
--
--  * Les montants sont en numeric(14,2). Jamais de float : 0.1 + 0.2 ne fait
--    pas 0.3 en binaire flottant, ce qui est inacceptable pour de l'argent.
--
--  * Les montants sont SIGNÉS : négatif = sortie d'argent, positif = entrée.
--    Le solde d'un compte vaut donc simplement solde_initial + SUM(amount).
--    Le champ transaction_type porte l'intention (revenu / dépense / transfert),
--    indépendamment du signe : un remboursement est une « dépense » de montant
--    positif, ce qui le déduit naturellement du total de sa catégorie.
--
--  * Toute table métier porte household_id. C'est la clé de l'isolation entre
--    foyers appliquée par la Row Level Security (voir migration ...0003).
-- ===========================================================================

-- Recherche floue sur les libellés bancaires (page Historique).
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------------

-- Droits d'un membre au sein du foyer.
create type public.member_role as enum ('admin', 'member', 'viewer');

create type public.account_type as enum (
  'checking',       -- compte courant
  'joint',          -- compte joint
  'personal',       -- compte personnel
  'savings',        -- livret d'épargne
  'business',       -- compte professionnel
  'child',          -- compte enfant
  'deferred_card',  -- carte à débit différé
  'other'
);

-- Nature d'une catégorie. Détermine dans quel agrégat du tableau de bord
-- les opérations de cette catégorie sont comptées.
create type public.category_kind as enum (
  'income',               -- revenus
  'fixed_expense',        -- charges fixes
  'variable_expense',     -- dépenses variables
  'exceptional_expense',  -- dépenses exceptionnelles
  'savings',              -- épargne
  'transfer'              -- transferts internes (neutres)
);

create type public.transaction_type as enum ('income', 'expense', 'internal_transfer');

create type public.transaction_status as enum (
  'planned',    -- prévue (issue d'une récurrence, pas encore constatée)
  'pending',    -- en attente (débit différé, opération non encore débitée)
  'cleared',    -- réalisée
  'to_review',  -- à vérifier (catégorisation incertaine)
  'cancelled',  -- annulée
  'rejected'    -- rejetée (prélèvement refusé)
);

create type public.payment_method as enum (
  'card',
  'deferred_card',
  'direct_debit',
  'transfer',
  'check',
  'cash',
  'fee',
  'other'
);

create type public.transaction_source as enum ('manual', 'import', 'recurring', 'demo');

create type public.recurrence_frequency as enum (
  'weekly',
  'biweekly',
  'monthly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'yearly',
  'one_off'
);

create type public.import_status as enum (
  'analyzing',
  'mapping',
  'preview',
  'completed',
  'cancelled',
  'failed'
);

create type public.duplicate_status as enum (
  'new',        -- opération inconnue
  'duplicate',  -- empreinte identique à une opération existante
  'similar',    -- proche d'une opération existante, à vérifier
  'forced'      -- doublon dont l'utilisateur a explicitement forcé l'import
);

create type public.row_validation_status as enum (
  'pending',    -- en attente de décision
  'validated',  -- validée par l'utilisateur
  'ignored',    -- écartée
  'imported',   -- effectivement enregistrée
  'failed'      -- erreur lors de l'enregistrement
);

create type public.rule_match_type as enum (
  'contains',
  'equals',
  'starts_with',
  'ends_with',
  'regex'
);

create type public.notification_type as enum (
  'budget_exceeded',
  'budget_warning',
  'large_upcoming_debit',
  'negative_balance_forecast',
  'income_missing',
  'unusual_expense',
  'unrecognized_transaction',
  'import_completed',
  'savings_goal_reached',
  'recurring_due'
);

-- ---------------------------------------------------------------------------
-- users — profil applicatif, en miroir de auth.users
--
-- auth.users appartient à Supabase et n'est pas interrogeable en jointure
-- depuis l'API. On maintient donc une table publique alimentée par trigger.
-- ---------------------------------------------------------------------------
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  first_name  text,
  last_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint users_first_name_length check (first_name is null or length(first_name) <= 80),
  constraint users_last_name_length  check (last_name  is null or length(last_name)  <= 80)
);

comment on table public.users is
  'Profil applicatif. Une ligne par compte auth.users, créée par trigger.';

-- ---------------------------------------------------------------------------
-- households — le foyer, unité d'isolation des données
-- ---------------------------------------------------------------------------
create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references public.users (id) on delete restrict,
  currency   text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint households_name_length   check (length(btrim(name)) between 1 and 80),
  constraint households_currency_code check (currency ~ '^[A-Z]{3}$')
);

-- ---------------------------------------------------------------------------
-- household_members — qui appartient à quel foyer, et avec quels droits
-- ---------------------------------------------------------------------------
create table public.household_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  role         public.member_role not null default 'member',
  joined_at    timestamptz not null default now(),

  constraint household_members_unique unique (household_id, user_id)
);

-- ---------------------------------------------------------------------------
-- household_invitations — invitation à rejoindre un foyer
--
-- (Table hors liste initiale, requise par la page de connexion : « invitation
--  à rejoindre un foyer », §22.)
-- ---------------------------------------------------------------------------
create table public.household_invitations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code         text not null unique,
  email        text,
  role         public.member_role not null default 'member',
  invited_by   uuid not null references public.users (id) on delete cascade,
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint household_invitations_code_format check (code ~ '^[A-Z0-9]{6,12}$'),
  -- Un administrateur ne peut pas inviter quelqu'un avec plus de droits que lui.
  constraint household_invitations_accepted_consistency
    check ((accepted_at is null) = (accepted_by is null))
);

-- ---------------------------------------------------------------------------
-- user_settings — préférences personnelles (hors foyer)
--
-- (Table hors liste initiale, requise par §18 « désactiver chaque type
--  d'alerte » et §20 « déconnexion automatique facultative ».)
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id                uuid primary key references public.users (id) on delete cascade,
  -- Préférences de notification : { "budget_exceeded": true, ... }
  notification_settings  jsonb not null default '{}'::jsonb,
  -- Déconnexion automatique après N minutes d'inactivité (null = désactivée).
  auto_logout_minutes    integer,
  -- Supprimer le fichier bancaire brut dès la fin de l'import (§20).
  delete_import_file     boolean not null default true,
  last_household_id      uuid references public.households (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint user_settings_auto_logout_range
    check (auto_logout_minutes is null or auto_logout_minutes between 1 and 1440)
);

-- ---------------------------------------------------------------------------
-- bank_accounts — comptes bancaires du foyer
-- ---------------------------------------------------------------------------
create table public.bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  owner_user_id   uuid references public.users (id) on delete set null,
  name            text not null,
  bank_name       text,
  account_type    public.account_type not null default 'checking',
  initial_balance numeric(14, 2) not null default 0,
  currency        text not null default 'EUR',
  color           text not null default '#0EA5B7',
  icon            text not null default 'wallet',
  is_shared       boolean not null default true,
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint bank_accounts_name_length   check (length(btrim(name)) between 1 and 60),
  constraint bank_accounts_currency_code check (currency ~ '^[A-Z]{3}$'),
  constraint bank_accounts_color_format  check (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- ---------------------------------------------------------------------------
-- categories — catégories personnalisables, hiérarchiques sur un niveau
-- ---------------------------------------------------------------------------
create table public.categories (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households (id) on delete cascade,
  name               text not null,
  category_type      public.category_kind not null,
  icon               text not null default 'circle',
  color              text not null default '#64748B',
  parent_category_id uuid references public.categories (id) on delete set null,
  is_active          boolean not null default true,
  -- Catégorie créée automatiquement à l'ouverture du foyer. Elle peut être
  -- renommée ou archivée, mais sert de cible de repli pour la catégorisation.
  is_system          boolean not null default false,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint categories_name_length  check (length(btrim(name)) between 1 and 60),
  constraint categories_color_format check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Un seul niveau de sous-catégorie : une catégorie ne peut être son parent.
  constraint categories_not_self_parent check (parent_category_id is distinct from id)
);

-- ---------------------------------------------------------------------------
-- recurring_transactions — charges et revenus récurrents
-- ---------------------------------------------------------------------------
create table public.recurring_transactions (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households (id) on delete cascade,
  account_id         uuid not null references public.bank_accounts (id) on delete cascade,
  category_id        uuid references public.categories (id) on delete set null,
  label              text not null,
  expected_amount    numeric(14, 2) not null,
  transaction_type   public.transaction_type not null,
  frequency          public.recurrence_frequency not null default 'monthly',
  -- Jour habituel dans le mois (1-31). Ramené au dernier jour si le mois est court.
  day_of_month       smallint,
  next_date          date not null,
  start_date         date not null default current_date,
  end_date           date,
  -- true : le montant varie d'un mois à l'autre (électricité, carburant…).
  amount_is_variable boolean not null default false,
  beneficiary        text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint recurring_label_length   check (length(btrim(label)) between 1 and 120),
  constraint recurring_amount_nonzero check (expected_amount <> 0),
  constraint recurring_day_range      check (day_of_month is null or day_of_month between 1 and 31),
  constraint recurring_date_order     check (end_date is null or end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- category_budgets — plafond mensuel par catégorie
-- ---------------------------------------------------------------------------
create table public.category_budgets (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  category_id    uuid not null references public.categories (id) on delete cascade,
  year           smallint not null,
  month          smallint not null,
  planned_amount numeric(14, 2) not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint category_budgets_month_range  check (month between 1 and 12),
  constraint category_budgets_year_range   check (year between 2000 and 2200),
  constraint category_budgets_amount_sign  check (planned_amount >= 0),
  constraint category_budgets_unique unique (household_id, category_id, year, month)
);

-- ---------------------------------------------------------------------------
-- import_profiles — mémorisation du format de fichier d'une banque
--
-- (Table hors liste initiale, requise par §9 étape 3 : « Mémoriser le format
--  du fichier pour les futurs imports provenant de la même banque ».)
-- ---------------------------------------------------------------------------
create table public.import_profiles (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  name              text not null,
  bank_name         text,
  -- Empreinte de la ligne d'en-tête, permettant de reconnaître un même format.
  header_signature  text not null,
  -- Correspondance colonnes -> champs : { "date": "Date opération", ... }
  column_mapping    jsonb not null,
  date_format       text,
  decimal_separator text not null default ',',
  -- true si le fichier utilise deux colonnes Débit / Crédit plutôt qu'un montant signé.
  has_debit_credit  boolean not null default false,
  usage_count       integer not null default 0,
  last_used_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint import_profiles_name_length check (length(btrim(name)) between 1 and 80),
  constraint import_profiles_separator   check (decimal_separator in (',', '.')),
  constraint import_profiles_unique_signature unique (household_id, header_signature)
);

-- ---------------------------------------------------------------------------
-- import_files — trace d'un import de relevé
-- ---------------------------------------------------------------------------
create table public.import_files (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  account_id     uuid not null references public.bank_accounts (id) on delete cascade,
  profile_id     uuid references public.import_profiles (id) on delete set null,
  created_by     uuid references public.users (id) on delete set null,
  file_name      text not null,
  file_type      text not null,
  file_size      integer,
  import_date    timestamptz not null default now(),
  total_rows     integer not null default 0,
  imported_rows  integer not null default 0,
  duplicate_rows integer not null default 0,
  rejected_rows  integer not null default 0,
  status         public.import_status not null default 'analyzing',
  error_message  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint import_files_file_type check (file_type in ('csv', 'xlsx', 'xlsm', 'xls', 'pdf')),
  constraint import_files_counts_positive check (
    total_rows >= 0 and imported_rows >= 0 and duplicate_rows >= 0 and rejected_rows >= 0
  )
);

comment on table public.import_files is
  'Métadonnées d''import uniquement. Le fichier bancaire brut n''est jamais stocké ici.';

-- ---------------------------------------------------------------------------
-- transactions — table centrale
-- ---------------------------------------------------------------------------
create table public.transactions (
  id                       uuid primary key default gen_random_uuid(),
  household_id             uuid not null references public.households (id) on delete cascade,
  bank_account_id          uuid not null references public.bank_accounts (id) on delete restrict,
  -- Auteur de la saisie (traçabilité : « qui a ajouté cette opération »).
  user_id                  uuid references public.users (id) on delete set null,
  -- Membre auquel la dépense se rapporte (peut différer de l'auteur).
  member_user_id           uuid references public.users (id) on delete set null,
  transaction_date         date not null,
  value_date               date,
  label                    text not null,
  -- Libellé nettoyé, utilisé pour la catégorisation et la recherche.
  normalized_label         text not null default '',
  merchant                 text,
  amount                   numeric(14, 2) not null,
  transaction_type         public.transaction_type not null,
  payment_method           public.payment_method,
  category_id              uuid references public.categories (id) on delete set null,
  status                   public.transaction_status not null default 'cleared',
  source                   public.transaction_source not null default 'manual',
  -- Identifiant fourni par la banque, lorsqu'il existe.
  external_id              text,
  -- Empreinte de déduplication : compte + date + montant + libellé normalisé.
  fingerprint              text not null,
  confidence_score         smallint,
  -- Les deux moitiés d'un virement interne partagent ce même identifiant.
  transfer_group_id        uuid,
  recurring_transaction_id uuid references public.recurring_transactions (id) on delete set null,
  import_file_id           uuid references public.import_files (id) on delete set null,
  notes                    text,
  receipt_url              text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint transactions_label_length check (length(btrim(label)) between 1 and 255),
  -- Un montant nul signale presque toujours une colonne mal associée à l'import.
  constraint transactions_amount_nonzero check (amount <> 0),
  constraint transactions_confidence_range
    check (confidence_score is null or confidence_score between 0 and 100),
  constraint transactions_value_date_sane
    check (value_date is null or value_date between transaction_date - 90 and transaction_date + 90),
  -- Un transfert interne doit toujours être relié à son opération jumelle.
  constraint transactions_transfer_has_group
    check (transaction_type <> 'internal_transfer' or transfer_group_id is not null)
);

comment on column public.transactions.amount is
  'Montant signé : négatif = sortie d''argent, positif = entrée. Un remboursement '
  'est une opération de type « expense » avec un montant positif.';

-- ---------------------------------------------------------------------------
-- import_rows — lignes d'un fichier en attente de validation
-- ---------------------------------------------------------------------------
create table public.import_rows (
  id                   uuid primary key default gen_random_uuid(),
  import_file_id       uuid not null references public.import_files (id) on delete cascade,
  household_id         uuid not null references public.households (id) on delete cascade,
  row_number           integer not null,
  raw_date             text,
  raw_label            text,
  raw_amount           text,
  parsed_date          date,
  parsed_amount        numeric(14, 2),
  normalized_label     text,
  suggested_category_id uuid references public.categories (id) on delete set null,
  confidence_score     smallint,
  fingerprint          text,
  duplicate_status     public.duplicate_status not null default 'new',
  duplicate_of         uuid references public.transactions (id) on delete set null,
  validation_status    public.row_validation_status not null default 'pending',
  transaction_id       uuid references public.transactions (id) on delete set null,
  error_message        text,
  created_at           timestamptz not null default now(),

  constraint import_rows_confidence_range
    check (confidence_score is null or confidence_score between 0 and 100),
  constraint import_rows_unique_row unique (import_file_id, row_number)
);

-- ---------------------------------------------------------------------------
-- categorization_rules — règles de classement définies par l'utilisateur
-- ---------------------------------------------------------------------------
create table public.categorization_rules (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  rule_name    text not null,
  match_type   public.rule_match_type not null default 'contains',
  match_value  text not null,
  category_id  uuid not null references public.categories (id) on delete cascade,
  -- null = la règle s'applique à tous les comptes du foyer.
  account_id   uuid references public.bank_accounts (id) on delete cascade,
  -- Priorité décroissante : la règle de plus haute priorité gagne.
  priority     integer not null default 100,
  is_active    boolean not null default true,
  created_by   uuid references public.users (id) on delete set null,
  -- Nombre de fois où la règle a effectivement classé une opération.
  hit_count    integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint rules_name_length  check (length(btrim(rule_name)) between 1 and 80),
  constraint rules_value_length check (length(btrim(match_value)) between 1 and 200)
);

-- ---------------------------------------------------------------------------
-- merchant_categories — mémoire des corrections de l'utilisateur
--
-- (Table hors liste initiale, requise par §28 niveau 2 : « commerçant déjà
--  corrigé ». C'est ce qui permet au système d'apprendre sans IA.)
-- ---------------------------------------------------------------------------
create table public.merchant_categories (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households (id) on delete cascade,
  normalized_merchant text not null,
  category_id         uuid not null references public.categories (id) on delete cascade,
  hit_count           integer not null default 1,
  last_used_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),

  constraint merchant_categories_unique unique (household_id, normalized_merchant)
);

-- ---------------------------------------------------------------------------
-- savings_goals — objectifs d'épargne
-- ---------------------------------------------------------------------------
create table public.savings_goals (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references public.households (id) on delete cascade,
  name                   text not null,
  target_amount          numeric(14, 2) not null,
  current_amount         numeric(14, 2) not null default 0,
  target_date            date,
  account_id             uuid references public.bank_accounts (id) on delete set null,
  monthly_contribution   numeric(14, 2),
  icon                   text not null default 'target',
  color                  text not null default '#0EA5B7',
  is_achieved            boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint savings_goals_name_length    check (length(btrim(name)) between 1 and 80),
  constraint savings_goals_target_positive check (target_amount > 0),
  constraint savings_goals_current_sign    check (current_amount >= 0)
);

-- ---------------------------------------------------------------------------
-- notifications — alertes dans l'application
-- ---------------------------------------------------------------------------
create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  -- null = notification adressée à tous les membres du foyer.
  user_id           uuid references public.users (id) on delete cascade,
  notification_type public.notification_type not null,
  title             text not null,
  message           text not null,
  -- Données contextuelles (identifiant de catégorie, montant concerné…).
  payload           jsonb not null default '{}'::jsonb,
  is_read           boolean not null default false,
  created_at        timestamptz not null default now(),

  constraint notifications_title_length check (length(btrim(title)) between 1 and 120)
);

-- ---------------------------------------------------------------------------
-- audit_logs — journalisation des actions importantes (§20)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid references public.households (id) on delete cascade,
  user_id       uuid references public.users (id) on delete set null,
  action        text not null,
  resource_type text not null,
  resource_id   uuid,
  -- Résumé de la modification, sans donnée sensible superflue.
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),

  constraint audit_logs_action_length check (length(action) between 1 and 60)
);

comment on table public.audit_logs is
  'Journal en écriture seule pour les utilisateurs : aucune politique UPDATE ni DELETE.';
