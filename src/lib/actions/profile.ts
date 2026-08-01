'use server'

import { redirect } from 'next/navigation'

import { errorState, formString, validateForm, type FormState } from '@/lib/forms'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { deleteAccountSchema } from '@/lib/validation/profile'

/**
 * Supprime le compte de l'utilisateur connecté (§18, droit à l'effacement).
 *
 * Un foyer partagé ne peut pas disparaître parce qu'une seule personne s'en
 * va : si l'utilisateur est propriétaire d'un foyer où d'autres membres sont
 * présents, la suppression est refusée tant qu'il ne les a pas retirés (ou
 * n'a pas quitté ce rôle autrement). S'il est seul dans un foyer qu'il
 * possède, ce foyer — et toutes ses données — disparaît avec lui : c'est le
 * comportement attendu d'une suppression de compte.
 *
 * Le compte d'authentification lui-même (auth.users) n'est protégé par
 * aucune politique RLS : sa suppression exige donc la clé service_role,
 * jamais accessible depuis le navigateur.
 */
export async function deleteMyAccountAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(deleteAccountSchema, {
    confirmation: formString(formData, 'confirmation'),
  })

  if (!validation.success) return validation.state

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const { data: ownedHouseholds, error: ownedError } = await supabase
    .from('households')
    .select('id, name')
    .eq('owner_id', user.id)

  if (ownedError) {
    return errorState('Une erreur est survenue. Réessayez.')
  }

  for (const household of ownedHouseholds ?? []) {
    const { count } = await supabase
      .from('household_members')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', household.id)
      .neq('user_id', user.id)

    if ((count ?? 0) > 0) {
      return errorState(
        `Vous êtes le créateur du foyer « ${household.name} », qui compte d'autres ` +
          'membres. Retirez-les depuis la page Foyer avant de supprimer votre compte.',
      )
    }
  }

  for (const household of ownedHouseholds ?? []) {
    const { error } = await supabase.from('households').delete().eq('id', household.id)
    if (error) {
      return errorState(
        `La suppression du foyer « ${household.name} » a échoué. Réessayez.`,
      )
    }
  }

  const admin = createAdminClient()
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id)

  if (deleteUserError) {
    return errorState(
      'La suppression du compte a échoué. Réessayez plus tard ou contactez le support.',
    )
  }

  await supabase.auth.signOut()
  redirect('/')
}
