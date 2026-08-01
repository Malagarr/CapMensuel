-- ===========================================================================
-- Budget Foyer — Stockage des fichiers
--
--   ⚠ MIGRATION FACULTATIVE — vous pouvez la remettre à plus tard.
--
--   Elle ne concerne que les photos de profil et les justificatifs d'opération.
--   Aucune fonctionnalité des étapes 1 à 12 n'en dépend : si elle échoue,
--   passez à la suite, l'application fonctionnera normalement.
--
--   Erreur fréquente :
--     ERROR: 42501: must be owner of table objects
--
--   Sur les projets Supabase récents, la table storage.objects appartient au
--   rôle supabase_storage_admin, et non au rôle postgres utilisé par le SQL
--   Editor : la création de politiques y est donc refusée. Deux solutions :
--
--     1. Créer les politiques depuis le tableau de bord :
--        Storage > sélectionner le compartiment > Policies > New policy.
--        Les conditions à recopier sont celles des « using » ci-dessous.
--
--     2. Utiliser la CLI Supabase (supabase db push), qui se connecte avec un
--        rôle disposant des droits nécessaires.
--
--   La création des compartiments (premier bloc) réussit dans tous les cas :
--   si seule la partie « politiques » échoue, tout le reste est déjà en place.
--
-- Deux compartiments, tous deux privés :
--   * avatars  : photo de profil, chemin « {user_id}/… »
--   * receipts : justificatifs d'opération, chemin « {household_id}/… »
--
-- Aucun compartiment ne stocke de relevé bancaire brut : les fichiers CSV et
-- Excel sont analysés dans le navigateur et ne sont jamais téléversés (§21).
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    false,
    2 * 1024 * 1024, -- 2 Mo
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'receipts',
    'receipts',
    false,
    10 * 1024 * 1024, -- 10 Mo
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Conversion sûre de texte en UUID
--
-- Les politiques de stockage extraient l'identifiant du foyer depuis le chemin
-- du fichier. Un chemin mal formé provoquerait une erreur de cast bloquante :
-- cette fonction renvoie NULL plutôt que d'échouer.
-- ---------------------------------------------------------------------------

create or replace function public.safe_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- avatars — chaque utilisateur ne gère que son propre dossier
-- ---------------------------------------------------------------------------

create policy avatars_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.safe_uuid((storage.foldername(name))[1]) = auth.uid()
  );

create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.safe_uuid((storage.foldername(name))[1]) = auth.uid()
  );

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and public.safe_uuid((storage.foldername(name))[1]) = auth.uid()
  );

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and public.safe_uuid((storage.foldername(name))[1]) = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- receipts — accès réservé aux membres du foyer propriétaire du dossier
-- ---------------------------------------------------------------------------

create policy receipts_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and public.is_household_member(public.safe_uuid((storage.foldername(name))[1]))
  );

create policy receipts_insert_writer on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and public.can_write_household(public.safe_uuid((storage.foldername(name))[1]))
  );

create policy receipts_update_writer on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and public.can_write_household(public.safe_uuid((storage.foldername(name))[1]))
  );

create policy receipts_delete_writer on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and public.can_write_household(public.safe_uuid((storage.foldername(name))[1]))
  );
