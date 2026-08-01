-- ===========================================================================
-- Budget Foyer — Row Level Security
--
-- Principe : un utilisateur ne voit et ne modifie que les données des foyers
-- dont il est membre. Aucune exception.
--
-- Trois niveaux de droits (§3) :
--   * admin   : tout, y compris la gestion des membres et du foyer ;
--   * member  : lecture et écriture des données financières ;
--   * viewer  : lecture seule.
--
-- Toutes les politiques ciblent explicitement le rôle « authenticated » :
-- le rôle « anon » (visiteur non connecté) n'a ainsi accès à rien, même en cas
-- d'oubli d'une politique.
-- ===========================================================================

alter table public.users                 enable row level security;
alter table public.households            enable row level security;
alter table public.household_members     enable row level security;
alter table public.household_invitations enable row level security;
alter table public.user_settings         enable row level security;
alter table public.bank_accounts         enable row level security;
alter table public.categories            enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.category_budgets      enable row level security;
alter table public.import_profiles       enable row level security;
alter table public.import_files          enable row level security;
alter table public.transactions          enable row level security;
alter table public.import_rows           enable row level security;
alter table public.categorization_rules  enable row level security;
alter table public.merchant_categories   enable row level security;
alter table public.savings_goals         enable row level security;
alter table public.notifications         enable row level security;
alter table public.audit_logs            enable row level security;

-- ---------------------------------------------------------------------------
-- users
--
-- On voit son propre profil, et celui des personnes avec qui on partage un
-- foyer — indispensable pour afficher « ajouté par Marie » sur une opération.
-- ---------------------------------------------------------------------------

create policy users_select_self_or_household on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.household_members mine
      join public.household_members theirs
        on theirs.household_id = mine.household_id
      where mine.user_id = auth.uid()
        and theirs.user_id = public.users.id
    )
  );

create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Aucune politique INSERT ni DELETE : le profil est créé par le déclencheur
-- handle_new_user() et supprimé en cascade avec le compte auth.

-- ---------------------------------------------------------------------------
-- user_settings — strictement personnel
-- ---------------------------------------------------------------------------

create policy user_settings_all_self on public.user_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------

create policy households_select_member on public.households
  for select to authenticated
  using (public.is_household_member(id));

-- Tout utilisateur connecté peut créer son foyer, dont il est propriétaire.
create policy households_insert_own on public.households
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy households_update_admin on public.households
  for update to authenticated
  using (public.is_household_admin(id))
  with check (public.is_household_admin(id));

-- Seul le propriétaire peut supprimer le foyer (suppression en cascade).
create policy households_delete_owner on public.households
  for delete to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- household_members
-- ---------------------------------------------------------------------------

create policy household_members_select on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

-- Deux cas d'ajout :
--   1. l'administrateur ajoute quelqu'un ;
--   2. le créateur du foyer s'ajoute lui-même juste après l'avoir créé
--      (il n'est pas encore membre, donc pas encore administrateur).
create policy household_members_insert on public.household_members
  for insert to authenticated
  with check (
    public.is_household_admin(household_id)
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.households h
        where h.id = household_id and h.owner_id = auth.uid()
      )
    )
  );

create policy household_members_update_admin on public.household_members
  for update to authenticated
  using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

-- Un administrateur peut retirer un membre ; un membre peut quitter le foyer.
create policy household_members_delete on public.household_members
  for delete to authenticated
  using (
    public.is_household_admin(household_id)
    or user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- household_invitations
-- ---------------------------------------------------------------------------

create policy household_invitations_select_admin on public.household_invitations
  for select to authenticated
  using (public.is_household_admin(household_id));

create policy household_invitations_insert_admin on public.household_invitations
  for insert to authenticated
  with check (
    public.is_household_admin(household_id)
    and invited_by = auth.uid()
  );

create policy household_invitations_delete_admin on public.household_invitations
  for delete to authenticated
  using (public.is_household_admin(household_id));

-- L'acceptation d'une invitation passe par la fonction accept_household_invitation() :
-- l'invité n'est pas encore membre et ne peut donc pas lire cette table.

-- ---------------------------------------------------------------------------
-- Tables financières — même schéma de droits pour toutes
--
-- Lecture : tout membre. Écriture : admin et member. Le rôle viewer est exclu
-- des politiques INSERT / UPDATE / DELETE, ce qui réalise la « lecture seule ».
-- ---------------------------------------------------------------------------

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'bank_accounts',
    'categories',
    'recurring_transactions',
    'category_budgets',
    'import_profiles',
    'import_files',
    'transactions',
    'import_rows',
    'categorization_rules',
    'merchant_categories',
    'savings_goals'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.is_household_member(household_id))',
      target_table || '_select_member', target_table
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.can_write_household(household_id))',
      target_table || '_insert_writer', target_table
    );

    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.can_write_household(household_id))
         with check (public.can_write_household(household_id))',
      target_table || '_update_writer', target_table
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.can_write_household(household_id))',
      target_table || '_delete_writer', target_table
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- notifications
--
-- user_id nul signifie « destinée à tout le foyer ».
-- ---------------------------------------------------------------------------

create policy notifications_select on public.notifications
  for select to authenticated
  using (
    public.is_household_member(household_id)
    and (user_id is null or user_id = auth.uid())
  );

create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (public.can_write_household(household_id));

-- Sert à marquer une notification comme lue.
create policy notifications_update on public.notifications
  for update to authenticated
  using (
    public.is_household_member(household_id)
    and (user_id is null or user_id = auth.uid())
  )
  with check (
    public.is_household_member(household_id)
    and (user_id is null or user_id = auth.uid())
  );

create policy notifications_delete on public.notifications
  for delete to authenticated
  using (
    public.is_household_member(household_id)
    and (user_id is null or user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- audit_logs — consultable, jamais modifiable
--
-- Aucune politique INSERT, UPDATE ou DELETE n'est définie : les écritures
-- proviennent exclusivement du déclencheur record_audit_log(), qui est
-- SECURITY DEFINER et n'est donc pas soumis à ces politiques. Un utilisateur
-- ne peut ni effacer ni réécrire l'historique de ses actions.
-- ---------------------------------------------------------------------------

create policy audit_logs_select_member on public.audit_logs
  for select to authenticated
  using (household_id is not null and public.is_household_member(household_id));
