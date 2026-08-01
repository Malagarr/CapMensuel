'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { errorState, formString, successState, validateForm, type FormState } from '@/lib/forms'
import { setActiveHousehold } from '@/lib/household'
import { createClient } from '@/lib/supabase/server'
import {
  changeRoleSchema,
  createHouseholdSchema,
  inviteMemberSchema,
  joinHouseholdSchema,
  removeMemberSchema,
  renameHouseholdSchema,
} from '@/lib/validation/household'

/**
 * Récupère l'utilisateur connecté, ou lève une erreur.
 * Chaque action revérifie la session : ne jamais se fier au seul middleware.
 */
async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')
  return { supabase, user }
}

/** Traduit les erreurs remontées par les fonctions PostgreSQL. */
function translateDbError(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes("code d'invitation inconnu") || normalized.includes('no_data_found')) {
    return 'Ce code d’invitation n’existe pas. Vérifiez la saisie.'
  }
  if (normalized.includes('déjà été utilisée')) {
    return 'Cette invitation a déjà été utilisée.'
  }
  if (normalized.includes('expiré')) {
    return 'Cette invitation a expiré. Demandez-en une nouvelle.'
  }
  if (normalized.includes('réservée à une autre adresse')) {
    return 'Cette invitation est réservée à une autre adresse e-mail.'
  }
  if (normalized.includes('administrateur')) {
    return 'Seul un administrateur du foyer peut effectuer cette action.'
  }
  if (normalized.includes('duplicate key') || normalized.includes('unique')) {
    return 'Vous appartenez déjà à ce foyer.'
  }
  return 'Une erreur est survenue. Merci de réessayer.'
}

// ---------------------------------------------------------------------------
// Créer un foyer
// ---------------------------------------------------------------------------

export async function createHouseholdAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(createHouseholdSchema, {
    name: formString(formData, 'name'),
    currency: formString(formData, 'currency'),
  })

  if (!validation.success) return validation.state

  const { supabase } = await requireUser()

  // La fonction SQL crée le foyer, y ajoute son créateur comme administrateur
  // et installe les catégories par défaut — le tout dans une seule transaction.
  const { error } = await supabase.rpc('create_household', {
    household_name: validation.data.name,
    household_currency: validation.data.currency,
  })

  if (error) {
    return errorState(translateDbError(error.message))
  }

  redirect('/tableau-de-bord')
}

// ---------------------------------------------------------------------------
// Rejoindre un foyer avec un code
// ---------------------------------------------------------------------------

export async function joinHouseholdAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(joinHouseholdSchema, {
    code: formString(formData, 'code'),
  })

  if (!validation.success) return validation.state

  const { supabase } = await requireUser()

  const { error } = await supabase.rpc('accept_household_invitation', {
    invitation_code: validation.data.code,
  })

  if (error) {
    return errorState(translateDbError(error.message))
  }

  redirect('/tableau-de-bord')
}

// ---------------------------------------------------------------------------
// Inviter un membre
// ---------------------------------------------------------------------------

export async function inviteMemberAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const householdId = formString(formData, 'householdId')

  const validation = validateForm(inviteMemberSchema, {
    email: formString(formData, 'email'),
    role: formString(formData, 'role'),
  })

  if (!validation.success) return validation.state

  const { supabase } = await requireUser()

  const { error } = await supabase.rpc('create_household_invitation', {
    target_household_id: householdId,
    invitee_email: validation.data.email ?? null,
    invitee_role: validation.data.role,
  })

  if (error) {
    return errorState(translateDbError(error.message))
  }

  revalidatePath('/foyer')
  return successState('Invitation créée. Transmettez le code à la personne concernée.')
}

// ---------------------------------------------------------------------------
// Changer le rôle d'un membre
// ---------------------------------------------------------------------------

export async function changeRoleAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(changeRoleSchema, {
    memberId: formString(formData, 'memberId'),
    role: formString(formData, 'role'),
  })

  if (!validation.success) return validation.state

  const { supabase } = await requireUser()

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id, user_id, role')
    .eq('id', validation.data.memberId)
    .maybeSingle()

  if (!member) {
    return errorState('Ce membre n’existe plus.')
  }

  // Un foyer sans administrateur deviendrait ingérable : personne ne pourrait
  // plus inviter, retirer un membre ni renommer le foyer.
  if (member.role === 'admin' && validation.data.role !== 'admin') {
    const { count } = await supabase
      .from('household_members')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', member.household_id)
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return errorState(
        'Ce foyer doit conserver au moins un administrateur. Nommez d’abord quelqu’un d’autre.',
      )
    }
  }

  const { error } = await supabase
    .from('household_members')
    .update({ role: validation.data.role })
    .eq('id', validation.data.memberId)

  if (error) {
    return errorState(translateDbError(error.message))
  }

  revalidatePath('/foyer')
  return successState('Droits mis à jour.')
}

// ---------------------------------------------------------------------------
// Retirer un membre
// ---------------------------------------------------------------------------

export async function removeMemberAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(removeMemberSchema, {
    memberId: formString(formData, 'memberId'),
  })

  if (!validation.success) return validation.state

  const { supabase, user } = await requireUser()

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id, user_id, role, household:households(owner_id)')
    .eq('id', validation.data.memberId)
    .maybeSingle()

  if (!member) {
    return errorState('Ce membre n’existe plus.')
  }

  if (member.household?.owner_id === member.user_id) {
    return errorState(
      'Le créateur du foyer ne peut pas en être retiré. Transférez d’abord la propriété ou supprimez le foyer.',
    )
  }

  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('id', validation.data.memberId)

  if (error) {
    return errorState(translateDbError(error.message))
  }

  // Si l'utilisateur vient de se retirer lui-même, il n'a plus rien à voir ici.
  if (member.user_id === user.id) {
    redirect('/bienvenue')
  }

  revalidatePath('/foyer')
  return successState('Le membre a été retiré du foyer.')
}

// ---------------------------------------------------------------------------
// Annuler une invitation
// ---------------------------------------------------------------------------

export async function revokeInvitationAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const invitationId = formString(formData, 'invitationId')

  if (!invitationId) {
    return errorState('Invitation introuvable.')
  }

  const { supabase } = await requireUser()

  // « .select() » renvoie les lignes réellement supprimées. Sans lui, une
  // suppression bloquée par la Row Level Security ne produit ni erreur ni
  // ligne affectée : l'action semblerait réussir alors qu'il ne s'est rien
  // passé, et l'utilisateur resterait devant une invitation qu'il croit
  // supprimée.
  const { data, error } = await supabase
    .from('household_invitations')
    .delete()
    .eq('id', invitationId)
    .select('id')

  if (error) {
    return errorState(translateDbError(error.message))
  }

  if (!data || data.length === 0) {
    return errorState(
      'Cette invitation n’a pas pu être supprimée. Elle a peut-être déjà été retirée, ' +
        'ou vous n’êtes plus administrateur de ce foyer.',
    )
  }

  revalidatePath('/foyer')
  return successState('Invitation supprimée.')
}

// ---------------------------------------------------------------------------
// Renommer le foyer
// ---------------------------------------------------------------------------

export async function renameHouseholdAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const householdId = formString(formData, 'householdId')

  const validation = validateForm(renameHouseholdSchema, {
    name: formString(formData, 'name'),
  })

  if (!validation.success) return validation.state

  const { supabase } = await requireUser()

  const { error } = await supabase
    .from('households')
    .update({ name: validation.data.name })
    .eq('id', householdId)

  if (error) {
    return errorState(translateDbError(error.message))
  }

  revalidatePath('/foyer')
  return successState('Le nom du foyer a été modifié.')
}

// ---------------------------------------------------------------------------
// Changer de foyer actif
// ---------------------------------------------------------------------------

export async function switchHouseholdAction(formData: FormData): Promise<void> {
  const householdId = formString(formData, 'householdId')
  if (!householdId) return

  const { user } = await requireUser()
  await setActiveHousehold(user.id, householdId)

  revalidatePath('/', 'layout')
  redirect('/tableau-de-bord')
}
