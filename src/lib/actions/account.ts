'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { errorState, formString, successState, validateForm, type FormState } from '@/lib/forms'
import { getActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { accountIdSchema, accountSchema } from '@/lib/validation/account'

/**
 * Vérifie la session et les droits d'écriture sur le foyer actif.
 *
 * La Row Level Security refuserait déjà l'écriture à un membre en lecture
 * seule, mais avec une erreur technique. Ce contrôle permet un message clair.
 */
async function requireWriteAccess() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const active = await getActiveHousehold(user)
  if (!active) redirect('/bienvenue')

  return { supabase, user, active, allowed: canWrite(active.role) }
}

const READ_ONLY_MESSAGE =
  'Votre rôle est « lecture seule » : vous ne pouvez pas modifier les comptes.'

function translateDbError(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('violates foreign key') && normalized.includes('transactions')) {
    return 'Ce compte porte des opérations : il ne peut pas être supprimé. Archivez-le à la place.'
  }
  if (normalized.includes('duplicate key')) {
    return 'Un compte porte déjà ce nom.'
  }
  if (normalized.includes('row-level security') || normalized.includes('permission')) {
    return READ_ONLY_MESSAGE
  }
  return 'Une erreur est survenue. Merci de réessayer.'
}

// ---------------------------------------------------------------------------
// Créer ou modifier un compte
// ---------------------------------------------------------------------------

export async function saveAccountAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(accountSchema, {
    name: formString(formData, 'name'),
    bankName: formString(formData, 'bankName'),
    accountType: formString(formData, 'accountType'),
    initialBalance: formString(formData, 'initialBalance'),
    currency: formString(formData, 'currency'),
    color: formString(formData, 'color'),
    icon: formString(formData, 'icon'),
    ownerUserId: formString(formData, 'ownerUserId'),
    isShared: formString(formData, 'isShared') || undefined,
  })

  if (!validation.success) return validation.state

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const accountId = formString(formData, 'accountId')
  const values = validation.data

  const payload = {
    name: values.name,
    bank_name: values.bankName,
    account_type: values.accountType,
    initial_balance: values.initialBalance,
    currency: values.currency,
    color: values.color,
    icon: values.icon,
    owner_user_id: values.ownerUserId,
    is_shared: values.isShared,
  }

  if (accountId) {
    // Modification. Le filtre sur household_id est redondant avec la RLS,
    // mais évite qu'une erreur de code ne cible le compte d'un autre foyer.
    const { data, error } = await supabase
      .from('bank_accounts')
      .update(payload)
      .eq('id', accountId)
      .eq('household_id', active.household.id)
      .select('id')

    if (error) return errorState(translateDbError(error.message))
    if (!data || data.length === 0) {
      return errorState('Ce compte n’existe plus, ou vous n’avez pas le droit de le modifier.')
    }

    revalidatePath('/comptes')
    return successState('Compte mis à jour.')
  }

  const { error } = await supabase.from('bank_accounts').insert({
    ...payload,
    household_id: active.household.id,
  })

  if (error) return errorState(translateDbError(error.message))

  revalidatePath('/comptes')
  return successState('Compte créé.')
}

// ---------------------------------------------------------------------------
// Archiver / réactiver
// ---------------------------------------------------------------------------

export async function toggleAccountArchiveAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(accountIdSchema, {
    accountId: formString(formData, 'accountId'),
  })

  if (!validation.success) return validation.state

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const { data: account } = await supabase
    .from('bank_accounts')
    .select('is_active')
    .eq('id', validation.data.accountId)
    .eq('household_id', active.household.id)
    .maybeSingle()

  if (!account) return errorState('Ce compte n’existe plus.')

  const { data, error } = await supabase
    .from('bank_accounts')
    .update({ is_active: !account.is_active })
    .eq('id', validation.data.accountId)
    .eq('household_id', active.household.id)
    .select('id')

  if (error) return errorState(translateDbError(error.message))
  if (!data || data.length === 0) return errorState(READ_ONLY_MESSAGE)

  revalidatePath('/comptes')
  return successState(account.is_active ? 'Compte archivé.' : 'Compte réactivé.')
}

// ---------------------------------------------------------------------------
// Supprimer définitivement
// ---------------------------------------------------------------------------

export async function deleteAccountAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(accountIdSchema, {
    accountId: formString(formData, 'accountId'),
  })

  if (!validation.success) return validation.state

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  // La contrainte « on delete restrict » de transactions.bank_account_id
  // ferait échouer la suppression avec une erreur technique. On vérifie donc
  // d'abord, pour expliquer clairement et proposer l'archivage.
  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('bank_account_id', validation.data.accountId)

  if ((count ?? 0) > 0) {
    return errorState(
      `Ce compte porte ${count} opération${(count ?? 0) > 1 ? 's' : ''} : il ne peut pas être ` +
        'supprimé sans perdre cet historique. Archivez-le plutôt, il disparaîtra des écrans ' +
        'de saisie tout en conservant ses opérations.',
    )
  }

  const { data, error } = await supabase
    .from('bank_accounts')
    .delete()
    .eq('id', validation.data.accountId)
    .eq('household_id', active.household.id)
    .select('id')

  if (error) return errorState(translateDbError(error.message))
  if (!data || data.length === 0) {
    return errorState('Ce compte n’existe plus, ou vous n’avez pas le droit de le supprimer.')
  }

  revalidatePath('/comptes')
  return successState('Compte supprimé.')
}
