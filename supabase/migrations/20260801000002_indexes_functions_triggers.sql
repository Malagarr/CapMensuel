-- ===========================================================================
-- Budget Foyer — Index, fonctions et déclencheurs
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Index
--
-- Presque toutes les requêtes de l'application filtrent d'abord sur
-- household_id, puis sur une date ou une catégorie : les index composites
-- suivent cet ordre.
-- ---------------------------------------------------------------------------

create index household_members_user_idx      on public.household_members (user_id);
create index household_members_household_idx on public.household_members (household_id);

create index household_invitations_household_idx on public.household_invitations (household_id);
create index household_invitations_email_idx     on public.household_invitations (lower(email))
  where email is not null;

create index bank_accounts_household_idx on public.bank_accounts (household_id);
create index bank_accounts_active_idx    on public.bank_accounts (household_id, is_active)
  where is_active;

create index categories_household_idx on public.categories (household_id);
create index categories_parent_idx    on public.categories (parent_category_id)
  where parent_category_id is not null;

-- Un même nom ne peut pas être utilisé deux fois au même niveau de hiérarchie.
-- COALESCE remplace le parent nul par un UUID sentinelle : sans cela, deux
-- lignes à parent NULL seraient considérées comme distinctes par l'index.
create unique index categories_unique_name_idx on public.categories (
  household_id,
  coalesce(parent_category_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(btrim(name))
);

-- Index principaux de la table transactions.
create index transactions_household_date_idx
  on public.transactions (household_id, transaction_date desc);
create index transactions_account_date_idx
  on public.transactions (bank_account_id, transaction_date desc);
create index transactions_category_idx
  on public.transactions (household_id, category_id);
create index transactions_date_idx
  on public.transactions (transaction_date);
-- Recherche de doublons : c'est la requête la plus fréquente pendant un import.
create index transactions_fingerprint_idx
  on public.transactions (household_id, fingerprint);
create index transactions_normalized_label_idx
  on public.transactions (normalized_label);
-- Recherche floue sur le libellé (page Historique, barre de recherche).
create index transactions_label_trgm_idx
  on public.transactions using gin (normalized_label extensions.gin_trgm_ops);
create index transactions_transfer_group_idx
  on public.transactions (transfer_group_id)
  where transfer_group_id is not null;
create index transactions_import_file_idx
  on public.transactions (import_file_id)
  where import_file_id is not null;
create index transactions_recurring_idx
  on public.transactions (recurring_transaction_id)
  where recurring_transaction_id is not null;
create index transactions_member_idx
  on public.transactions (household_id, member_user_id)
  where member_user_id is not null;
-- Opérations à vérifier : badge affiché en permanence dans la navigation.
create index transactions_to_review_idx
  on public.transactions (household_id)
  where status = 'to_review';

create index recurring_household_idx on public.recurring_transactions (household_id);
create index recurring_next_date_idx on public.recurring_transactions (next_date)
  where is_active;

create index category_budgets_lookup_idx
  on public.category_budgets (household_id, year, month);

create index import_profiles_household_idx on public.import_profiles (household_id);

create index import_files_household_idx on public.import_files (household_id, import_date desc);
create index import_files_account_idx   on public.import_files (account_id);

create index import_rows_file_idx       on public.import_rows (import_file_id);
create index import_rows_household_idx  on public.import_rows (household_id);
create index import_rows_fingerprint_idx on public.import_rows (household_id, fingerprint)
  where fingerprint is not null;

create index categorization_rules_lookup_idx
  on public.categorization_rules (household_id, priority desc)
  where is_active;

create index merchant_categories_lookup_idx
  on public.merchant_categories (household_id, normalized_merchant);

create index savings_goals_household_idx on public.savings_goals (household_id);

create index notifications_user_idx
  on public.notifications (household_id, user_id, is_read, created_at desc);

create index audit_logs_household_idx on public.audit_logs (household_id, created_at desc);
create index audit_logs_resource_idx  on public.audit_logs (resource_type, resource_id);

-- ---------------------------------------------------------------------------
-- Horodatage automatique
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Renseigne updated_at à chaque modification. Empêche un client de falsifier la date.';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'households', 'user_settings', 'bank_accounts', 'categories',
    'recurring_transactions', 'category_budgets', 'import_profiles',
    'import_files', 'transactions', 'categorization_rules', 'savings_goals'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.set_updated_at()',
      'set_updated_at_' || table_name,
      table_name
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Création du profil applicatif à l'inscription
--
-- SECURITY DEFINER : le trigger s'exécute dans le contexte de auth, où le rôle
-- courant n'a pas le droit d'écrire dans public.users.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, email, first_name, last_name, avatar_url)
  values (
    new.id,
    new.email,
    -- Les métadonnées sont fournies au moment de l'inscription (signUp).
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Garde l'adresse e-mail du profil synchronisée si l'utilisateur la change.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.users set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Fonctions d'aide à la Row Level Security
--
-- Elles sont SECURITY DEFINER pour lire household_members sans déclencher la
-- RLS de cette table : une politique sur household_members qui interrogerait
-- household_members provoquerait une récursion infinie.
--
-- search_path est figé : sans cela, un utilisateur pourrait créer un schéma
-- temporaire contenant une fausse table household_members et détourner la
-- fonction (élévation de privilèges classique sur SECURITY DEFINER).
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = target_household_id
      and m.user_id = auth.uid()
  );
$$;

comment on function public.is_household_member is
  'Vrai si l''utilisateur courant appartient au foyer. Base de l''isolation des données.';

create or replace function public.household_role(target_household_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.household_members m
  where m.household_id = target_household_id
    and m.user_id = auth.uid();
$$;

-- Droit d'écriture : administrateur ou membre. Le rôle « viewer » lit seulement.
create or replace function public.can_write_household(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = target_household_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'member')
  );
$$;

create or replace function public.is_household_admin(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = target_household_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Journal d'audit
--
-- Le journal est alimenté par déclencheur plutôt que par le code applicatif :
-- aucune écriture ne peut ainsi échapper à la trace, même en cas d'oubli.
-- ---------------------------------------------------------------------------

create or replace function public.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_household uuid;
  affected_id        uuid;
  summary            jsonb := '{}'::jsonb;
begin
  if tg_op = 'DELETE' then
    affected_household := old.household_id;
    affected_id := old.id;
  else
    affected_household := new.household_id;
    affected_id := new.id;
  end if;

  -- On ne consigne qu'un résumé : le journal ne doit pas devenir une copie
  -- intégrale des données financières.
  if tg_table_name = 'transactions' then
    if tg_op = 'DELETE' then
      summary := jsonb_build_object('label', old.label, 'amount', old.amount);
    else
      summary := jsonb_build_object('label', new.label, 'amount', new.amount);
      if tg_op = 'UPDATE' and old.amount is distinct from new.amount then
        summary := summary || jsonb_build_object('previous_amount', old.amount);
      end if;
      if tg_op = 'UPDATE' and old.category_id is distinct from new.category_id then
        summary := summary || jsonb_build_object('previous_category_id', old.category_id);
      end if;
    end if;
  end if;

  insert into public.audit_logs (
    household_id, user_id, action, resource_type, resource_id, details
  )
  values (
    affected_household,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    affected_id,
    summary
  );

  return null; -- déclencheur AFTER : la valeur de retour est ignorée
end;
$$;

create trigger audit_transactions
  after insert or update or delete on public.transactions
  for each row execute function public.record_audit_log();

create trigger audit_bank_accounts
  after insert or update or delete on public.bank_accounts
  for each row execute function public.record_audit_log();

create trigger audit_category_budgets
  after insert or update or delete on public.category_budgets
  for each row execute function public.record_audit_log();

create trigger audit_household_members
  after insert or update or delete on public.household_members
  for each row execute function public.record_audit_log();

-- ---------------------------------------------------------------------------
-- Cohérence : une opération ne peut pas mélanger deux foyers
--
-- Sans ce contrôle, un client malveillant pourrait créer une opération dans son
-- propre foyer mais pointant vers le compte bancaire d'un autre foyer. La RLS
-- seule ne l'empêche pas : elle ne vérifie que la ligne insérée.
-- ---------------------------------------------------------------------------

create or replace function public.check_transaction_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account_household  uuid;
  category_household uuid;
begin
  select household_id into account_household
  from public.bank_accounts
  where id = new.bank_account_id;

  if account_household is null or account_household <> new.household_id then
    raise exception 'Le compte bancaire n''appartient pas à ce foyer'
      using errcode = 'check_violation';
  end if;

  if new.category_id is not null then
    select household_id into category_household
    from public.categories
    where id = new.category_id;

    if category_household is null or category_household <> new.household_id then
      raise exception 'La catégorie n''appartient pas à ce foyer'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger check_transaction_consistency
  before insert or update of household_id, bank_account_id, category_id
  on public.transactions
  for each row execute function public.check_transaction_consistency();

-- Même contrôle pour les budgets, les règles et les récurrences.
create or replace function public.check_category_household()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  category_household uuid;
begin
  if new.category_id is null then
    return new;
  end if;

  select household_id into category_household
  from public.categories
  where id = new.category_id;

  if category_household is null or category_household <> new.household_id then
    raise exception 'La catégorie n''appartient pas à ce foyer'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger check_category_budgets_household
  before insert or update of household_id, category_id on public.category_budgets
  for each row execute function public.check_category_household();

create trigger check_categorization_rules_household
  before insert or update of household_id, category_id on public.categorization_rules
  for each row execute function public.check_category_household();

create trigger check_recurring_household
  before insert or update of household_id, category_id on public.recurring_transactions
  for each row execute function public.check_category_household();

create trigger check_merchant_categories_household
  before insert or update of household_id, category_id on public.merchant_categories
  for each row execute function public.check_category_household();
