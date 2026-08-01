-- ===========================================================================
-- Budget Foyer — Données de démonstration (§20)
-- ===========================================================================
--
-- Remplit un foyer existant avec trois mois d'opérations réalistes (salaire,
-- charges fixes, courses, sorties, épargne...), pour disposer d'un tableau de
-- bord parlant sans saisir de vraies données ni importer un relevé.
--
-- À exécuter manuellement dans le SQL Editor Supabase (pas de CLI disponible
-- sur ce projet). N'est jamais joué automatiquement : ni migration, ni script
-- de build. Sans danger pour vos vraies données : tout est isolé dans un
-- compte bancaire dédié, « Compte courant (démo) », que ce script peut
-- réexécuter à volonté (il purge d'abord ses propres opérations).
--
-- Avant de lancer : remplacez target_owner_email par l'e-mail du compte dont
-- le foyer doit recevoir les données.

do $$
declare
  target_owner_email text := 'remplacez-moi@example.com';
  target_household_id uuid;
  demo_account_id uuid;
begin
  select h.id into target_household_id
  from public.households h
  join public.users u on u.id = h.owner_id
  where u.email = target_owner_email
  limit 1;

  if target_household_id is null then
    raise exception 'Aucun foyer trouvé pour le propriétaire %. Vérifiez target_owner_email.', target_owner_email;
  end if;

  -- Compte dédié à la démo, créé s'il n'existe pas encore.
  insert into public.bank_accounts
    (household_id, name, bank_name, account_type, initial_balance, currency, color, icon, is_shared)
  select target_household_id, 'Compte courant (démo)', 'Banque Démo', 'checking', 1500, 'EUR', '#0EA5B7', 'wallet', true
  where not exists (
    select 1 from public.bank_accounts
    where household_id = target_household_id and name = 'Compte courant (démo)'
  )
  returning id into demo_account_id;

  if demo_account_id is null then
    select id into demo_account_id
    from public.bank_accounts
    where household_id = target_household_id and name = 'Compte courant (démo)'
    limit 1;
  end if;

  -- Réexécutable : on repart d'un compte de démo vide plutôt que d'empiler
  -- les opérations à chaque lancement.
  delete from public.transactions where bank_account_id = demo_account_id;

  -- Trois mois d'opérations récurrentes (mois courant compris, mais limité
  -- aux jours déjà passés : un salaire versé le 28 n'existe pas encore si on
  -- est le 5 du mois).
  insert into public.transactions
    (household_id, bank_account_id, category_id, amount, transaction_date, status, label, transaction_type, fingerprint)
  select
    target_household_id,
    demo_account_id,
    (select id from public.categories where household_id = target_household_id and name = tpl.category_name),
    tpl.amount,
    (date_trunc('month', current_date) - (m.months_back || ' months')::interval + (tpl.day_offset || ' days')::interval)::date,
    'cleared',
    tpl.label,
    tpl.ttype::public.transaction_type,
    md5(tpl.label || tpl.amount::text || m.months_back::text || demo_account_id::text)
  from generate_series(0, 2) as m(months_back)
  cross join (values
    ('Salaire',       2200.00,   0, 'Virement salaire',      'income'),
    ('Loyer',         -750.00,   4, 'Loyer',                 'expense'),
    ('Électricité',   -64.30,    4, 'EDF',                   'expense'),
    ('Internet',      -34.90,    4, 'Fournisseur internet',  'expense'),
    ('Téléphone',     -24.99,    4, 'Opérateur mobile',      'expense'),
    ('Assurances',    -42.50,    6, 'Assurance habitation',  'expense'),
    ('Alimentation',  -87.40,    2, 'Supermarché',           'expense'),
    ('Alimentation',  -63.10,    9, 'Supermarché',           'expense'),
    ('Alimentation',  -102.85,   16, 'Supermarché',          'expense'),
    ('Alimentation',  -71.55,    23, 'Supermarché',          'expense'),
    ('Restaurants',   -28.00,    11, 'Restaurant',           'expense'),
    ('Restaurants',   -19.50,    19, 'Boulangerie',          'expense'),
    ('Carburant',     -62.00,    8,  'Station-service',      'expense'),
    ('Carburant',     -58.00,    22, 'Station-service',      'expense'),
    ('Transport',     -75.00,    1,  'Abonnement transports', 'expense'),
    ('Loisirs',       -32.00,    15, 'Cinéma',                'expense'),
    ('Épargne',       -200.00,   27, 'Virement épargne',      'expense')
  ) as tpl(category_name, amount, day_offset, label, ttype)
  where exists (
    select 1 from public.categories
    where household_id = target_household_id and name = tpl.category_name
  )
  and (m.months_back > 0 or tpl.day_offset < extract(day from current_date)::int);

  -- Une dépense exceptionnelle, un seul mois sur les trois, pour illustrer la
  -- distinction avec les dépenses variables.
  insert into public.transactions
    (household_id, bank_account_id, category_id, amount, transaction_date, status, label, transaction_type, fingerprint)
  select
    target_household_id,
    demo_account_id,
    (select id from public.categories where household_id = target_household_id and name = 'Vacances'),
    -430.00,
    (date_trunc('month', current_date) - interval '1 month' + interval '13 days')::date,
    'cleared',
    'Séjour week-end',
    'expense'::public.transaction_type,
    md5('demo-sejour-weekend-' || demo_account_id::text)
  where exists (
    select 1 from public.categories
    where household_id = target_household_id and name = 'Vacances'
  );

  raise notice 'Données de démonstration insérées pour le foyer % (compte %).', target_household_id, demo_account_id;
end $$;

-- Pour tout effacer et repartir d'un foyer vide, exécutez séparément :
--
--   delete from public.transactions
--   where bank_account_id in (
--     select id from public.bank_accounts where name = 'Compte courant (démo)'
--   );
--   delete from public.bank_accounts where name = 'Compte courant (démo)';
