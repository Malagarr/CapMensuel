-- ===========================================================================
-- Budget Foyer — Fonctions métier et vues
-- ===========================================================================

-- Génération de codes d'invitation cryptographiquement aléatoires.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Catégories par défaut d'un nouveau foyer
--
-- Elles sont marquées is_system : l'utilisateur peut les renommer, changer leur
-- icône ou les archiver, mais elles servent de point de départ immédiatement
-- exploitable. Sans elles, la première saisie serait impossible.
-- ---------------------------------------------------------------------------

create or replace function public.seed_default_categories(target_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.categories
    (household_id, name, category_type, icon, color, is_system, sort_order)
  values
    -- Revenus (§6)
    (target_household_id, 'Salaire',              'income', 'briefcase',    '#0F9D58', true, 10),
    (target_household_id, 'Prime',                'income', 'award',        '#12A150', true, 20),
    (target_household_id, 'Allocation',           'income', 'hand-coins',   '#16A34A', true, 30),
    (target_household_id, 'Pension',              'income', 'user-round',   '#22A55B', true, 40),
    (target_household_id, 'Revenu locatif',       'income', 'building-2',   '#2E9E63', true, 50),
    (target_household_id, 'Remboursement',        'income', 'undo-2',       '#3AA06B', true, 60),
    (target_household_id, 'Revenu exceptionnel',  'income', 'sparkles',     '#45A273', true, 70),
    (target_household_id, 'Autre revenu',         'income', 'circle-plus',  '#51A47B', true, 80),

    -- Charges fixes (§7)
    (target_household_id, 'Logement',        'fixed_expense', 'house',      '#4F46E5', true, 100),
    (target_household_id, 'Prêt immobilier', 'fixed_expense', 'landmark',   '#4338CA', true, 110),
    (target_household_id, 'Loyer',           'fixed_expense', 'key-round',  '#5B52E8', true, 120),
    (target_household_id, 'Électricité',     'fixed_expense', 'zap',        '#F59E0B', true, 130),
    (target_household_id, 'Eau',             'fixed_expense', 'droplet',    '#0EA5E9', true, 140),
    (target_household_id, 'Gaz',             'fixed_expense', 'flame',      '#EA580C', true, 150),
    (target_household_id, 'Assurances',      'fixed_expense', 'shield',     '#0F766E', true, 160),
    (target_household_id, 'Téléphone',       'fixed_expense', 'smartphone', '#6366F1', true, 170),
    (target_household_id, 'Internet',        'fixed_expense', 'wifi',       '#7C3AED', true, 180),
    (target_household_id, 'Abonnements',     'fixed_expense', 'repeat',     '#8B5CF6', true, 190),
    (target_household_id, 'Impôts',          'fixed_expense', 'scale',      '#64748B', true, 200),

    -- Dépenses variables (§7)
    (target_household_id, 'Alimentation', 'variable_expense', 'shopping-cart', '#16A34A', true, 300),
    (target_household_id, 'Restaurants',  'variable_expense', 'utensils',      '#DC2626', true, 310),
    (target_household_id, 'Carburant',    'variable_expense', 'fuel',          '#B45309', true, 320),
    (target_household_id, 'Transport',    'variable_expense', 'train-front',   '#0891B2', true, 330),
    (target_household_id, 'Véhicule',     'variable_expense', 'car',           '#475569', true, 340),
    (target_household_id, 'Enfants',      'variable_expense', 'baby',          '#DB2777', true, 350),
    (target_household_id, 'Santé',        'variable_expense', 'heart-pulse',   '#E11D48', true, 360),
    (target_household_id, 'Vêtements',    'variable_expense', 'shirt',         '#9333EA', true, 370),
    (target_household_id, 'Loisirs',      'variable_expense', 'gamepad-2',     '#2563EB', true, 380),
    (target_household_id, 'Animaux',      'variable_expense', 'paw-print',     '#A16207', true, 390),
    (target_household_id, 'Cadeaux',      'variable_expense', 'gift',          '#C026D3', true, 400),
    (target_household_id, 'Autres dépenses', 'variable_expense', 'circle-ellipsis', '#78716C', true, 410),

    -- Dépenses exceptionnelles (§7)
    (target_household_id, 'Vacances', 'exceptional_expense', 'palmtree', '#0D9488', true, 500),
    (target_household_id, 'Travaux',  'exceptional_expense', 'hammer',   '#92400E', true, 510),

    -- Épargne et transferts
    (target_household_id, 'Épargne',           'savings',  'piggy-bank',      '#059669', true, 600),
    (target_household_id, 'Transfert interne', 'transfer', 'arrow-left-right', '#94A3B8', true, 700)
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_household — création atomique d'un foyer
--
-- Trois écritures doivent réussir ou échouer ensemble : le foyer, son premier
-- membre (administrateur) et les catégories par défaut. Passer par une fonction
-- évite de laisser un foyer orphelin si le client s'interrompt en cours de route.
-- ---------------------------------------------------------------------------

create or replace function public.create_household(
  household_name text,
  household_currency text default 'EUR'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_uid  uuid := auth.uid();
  new_household uuid;
begin
  if current_uid is null then
    raise exception 'Authentification requise' using errcode = 'insufficient_privilege';
  end if;

  if length(btrim(coalesce(household_name, ''))) = 0 then
    raise exception 'Le nom du foyer est obligatoire' using errcode = 'check_violation';
  end if;

  insert into public.households (name, owner_id, currency)
  values (btrim(household_name), current_uid, upper(coalesce(household_currency, 'EUR')))
  returning id into new_household;

  insert into public.household_members (household_id, user_id, role)
  values (new_household, current_uid, 'admin');

  perform public.seed_default_categories(new_household);

  -- Mémorise le foyer courant pour la prochaine connexion.
  insert into public.user_settings (user_id, last_household_id)
  values (current_uid, new_household)
  on conflict (user_id) do update set last_household_id = excluded.last_household_id;

  return new_household;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_household_invitation — génère un code d'invitation
-- ---------------------------------------------------------------------------

create or replace function public.create_household_invitation(
  target_household_id uuid,
  invitee_email text default null,
  invitee_role public.member_role default 'member'
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_uid     uuid := auth.uid();
  invitation_code text;
begin
  if not public.is_household_admin(target_household_id) then
    raise exception 'Seul un administrateur du foyer peut inviter'
      using errcode = 'insufficient_privilege';
  end if;

  -- 6 octets aléatoires -> 12 caractères hexadécimaux en majuscules.
  invitation_code := upper(encode(extensions.gen_random_bytes(6), 'hex'));

  insert into public.household_invitations
    (household_id, code, email, role, invited_by)
  values (
    target_household_id,
    invitation_code,
    nullif(btrim(lower(coalesce(invitee_email, ''))), ''),
    invitee_role,
    current_uid
  );

  return invitation_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- accept_household_invitation — rejoindre un foyer
--
-- SECURITY DEFINER indispensable : l'invité n'étant pas encore membre, la RLS
-- l'empêche de lire la table des invitations et d'écrire dans celle des membres.
-- ---------------------------------------------------------------------------

create or replace function public.accept_household_invitation(invitation_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_uid uuid := auth.uid();
  user_email  text;
  invitation  public.household_invitations;
begin
  if current_uid is null then
    raise exception 'Authentification requise' using errcode = 'insufficient_privilege';
  end if;

  select * into invitation
  from public.household_invitations
  where code = upper(btrim(invitation_code));

  if invitation.id is null then
    raise exception 'Code d''invitation inconnu' using errcode = 'no_data_found';
  end if;

  if invitation.accepted_at is not null then
    raise exception 'Cette invitation a déjà été utilisée' using errcode = 'check_violation';
  end if;

  if invitation.expires_at < now() then
    raise exception 'Cette invitation a expiré' using errcode = 'check_violation';
  end if;

  -- Si l'invitation vise une adresse précise, elle n'est valable que pour elle.
  if invitation.email is not null then
    select lower(email) into user_email from public.users where id = current_uid;
    if user_email is distinct from invitation.email then
      raise exception 'Cette invitation est réservée à une autre adresse e-mail'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, current_uid, invitation.role)
  on conflict (household_id, user_id) do nothing;

  update public.household_invitations
  set accepted_at = now(), accepted_by = current_uid
  where id = invitation.id;

  insert into public.user_settings (user_id, last_household_id)
  values (current_uid, invitation.household_id)
  on conflict (user_id) do update set last_household_id = excluded.last_household_id;

  return invitation.household_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vue des soldes de comptes
--
-- « security_invoker = on » est essentiel : sans cette option, la vue
-- s'exécuterait avec les droits de son propriétaire et contournerait la RLS,
-- exposant les comptes de tous les foyers.
-- ---------------------------------------------------------------------------

create or replace view public.account_balances
with (security_invoker = on) as
select
  a.id           as account_id,
  a.household_id,
  a.name,
  a.currency,
  a.initial_balance,
  -- Solde constaté : uniquement les opérations effectivement passées en banque.
  a.initial_balance
    + coalesce(sum(t.amount) filter (where t.status = 'cleared'), 0) as current_balance,
  -- Solde théorique : y compris les opérations en attente et prévues.
  a.initial_balance
    + coalesce(
        sum(t.amount) filter (where t.status in ('cleared', 'pending', 'planned')),
        0
      ) as projected_balance,
  count(t.id) filter (where t.status = 'cleared') as cleared_count
from public.bank_accounts a
left join public.transactions t
  on t.bank_account_id = a.id
  -- Une opération annulée ou rejetée n'a jamais bougé d'argent.
  and t.status not in ('cancelled', 'rejected')
group by a.id, a.household_id, a.name, a.currency, a.initial_balance;

comment on view public.account_balances is
  'Soldes calculés. current_balance = opérations réalisées ; projected_balance inclut le prévu.';

-- ---------------------------------------------------------------------------
-- Droits d'exécution
--
-- Par défaut, PostgreSQL accorde EXECUTE à PUBLIC sur les nouvelles fonctions.
-- Sur des fonctions SECURITY DEFINER, cela reviendrait à les ouvrir aux
-- visiteurs non connectés : on retire ce droit puis on le rend explicitement.
-- ---------------------------------------------------------------------------

revoke execute on function public.seed_default_categories(uuid) from public;
revoke execute on function public.create_household(text, text) from public;
revoke execute on function public.create_household_invitation(uuid, text, public.member_role) from public;
revoke execute on function public.accept_household_invitation(text) from public;
revoke execute on function public.is_household_member(uuid) from public;
revoke execute on function public.household_role(uuid) from public;
revoke execute on function public.can_write_household(uuid) from public;
revoke execute on function public.is_household_admin(uuid) from public;

grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.create_household_invitation(uuid, text, public.member_role) to authenticated;
grant execute on function public.accept_household_invitation(text) to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.household_role(uuid) to authenticated;
grant execute on function public.can_write_household(uuid) to authenticated;
grant execute on function public.is_household_admin(uuid) to authenticated;

-- seed_default_categories n'est appelée que depuis create_household : elle
-- reste inaccessible directement.
