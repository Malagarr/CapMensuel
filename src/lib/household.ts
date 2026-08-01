import 'server-only'

import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import type { Household, MemberRole } from '@/types/database'

/** Foyer actif de l'utilisateur, avec son rôle dedans. */
export type ActiveHousehold = {
  household: Household
  role: MemberRole
  /** Le propriétaire est le créateur : lui seul peut supprimer le foyer. */
  isOwner: boolean
}

export type HouseholdSummary = {
  id: string
  name: string
  currency: string
  role: MemberRole
  memberCount: number
}

/**
 * Liste les foyers dont l'utilisateur est membre.
 * Un utilisateur peut appartenir à plusieurs foyers (personnel, colocation…).
 */
export async function listUserHouseholds(userId: string): Promise<HouseholdSummary[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('household_members')
    .select('role, household:households(id, name, currency)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })

  if (error || !data) return []

  const households = data
    .filter((row) => row.household !== null)
    .map((row) => ({
      id: row.household!.id,
      name: row.household!.name,
      currency: row.household!.currency,
      role: row.role,
    }))

  if (households.length === 0) return []

  // Le nombre de membres est récupéré en une seule requête plutôt qu'une par
  // foyer, pour éviter le problème des requêtes en cascade (N+1).
  const { data: members } = await supabase
    .from('household_members')
    .select('household_id')
    .in(
      'household_id',
      households.map((h) => h.id),
    )

  const counts = new Map<string, number>()
  for (const member of members ?? []) {
    counts.set(member.household_id, (counts.get(member.household_id) ?? 0) + 1)
  }

  return households.map((h) => ({ ...h, memberCount: counts.get(h.id) ?? 1 }))
}

/**
 * Renvoie le foyer actif, ou null si l'utilisateur n'en a aucun.
 *
 * Le foyer actif est celui mémorisé dans user_settings.last_household_id. On
 * vérifie systématiquement que l'utilisateur en est toujours membre : il a pu
 * en être retiré depuis sa dernière visite.
 */
export async function getActiveHousehold(user: User): Promise<ActiveHousehold | null> {
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('user_settings')
    .select('last_household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: memberships } = await supabase
    .from('household_members')
    .select('role, household:households(*)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })

  const valid = (memberships ?? []).filter((row) => row.household !== null)
  if (valid.length === 0) return null

  const preferred =
    valid.find((row) => row.household!.id === settings?.last_household_id) ?? valid[0]!

  const household = preferred.household as Household

  return {
    household,
    role: preferred.role,
    isOwner: household.owner_id === user.id,
  }
}

/**
 * Comme getActiveHousehold, mais redirige vers l'accueil d'intégration si
 * l'utilisateur n'appartient encore à aucun foyer.
 *
 * À utiliser en tête de chaque page qui manipule des données financières.
 */
export async function requireActiveHousehold(user: User): Promise<ActiveHousehold> {
  const active = await getActiveHousehold(user)
  if (!active) redirect('/bienvenue')
  return active
}

/** Mémorise le foyer sur lequel l'utilisateur travaille. */
export async function setActiveHousehold(userId: string, householdId: string): Promise<void> {
  const supabase = await createClient()

  // On ne mémorise que si l'utilisateur est réellement membre : sinon, un
  // identifiant fabriqué à la main resterait stocké dans ses préférences.
  const { data: membership } = await supabase
    .from('household_members')
    .select('id')
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .maybeSingle()

  if (!membership) return

  await supabase
    .from('user_settings')
    .upsert({ user_id: userId, last_household_id: householdId }, { onConflict: 'user_id' })
}
