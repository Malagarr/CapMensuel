'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { buildFingerprint, extractMerchant, normalizeLabel } from '@/lib/banking/normalize'
import { errorState, formString, successState, validateForm, type FormState } from '@/lib/forms'
import { getActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import {
  transactionIdSchema,
  transactionSchema,
  transferSchema,
} from '@/lib/validation/transaction'

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
  'Votre rôle est « lecture seule » : vous ne pouvez pas saisir d’opération.'

function translateDbError(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes("n'appartient pas à ce foyer")) {
    return 'Le compte ou la catégorie choisie n’appartient pas à ce foyer.'
  }
  if (normalized.includes('transactions_amount_nonzero')) {
    return 'Le montant ne peut pas être nul.'
  }
  if (normalized.includes('row-level security') || normalized.includes('permission')) {
    return READ_ONLY_MESSAGE
  }
  return 'Une erreur est survenue. Merci de réessayer.'
}

/** Assemble les champs dérivés d'un libellé : normalisation, commerçant, empreinte. */
function derivedLabelFields(input: {
  label: string
  accountId: string
  date: string
  amount: number
}) {
  const normalized = normalizeLabel(input.label)
  return {
    normalized_label: normalized,
    merchant: extractMerchant(normalized) || null,
    fingerprint: buildFingerprint({
      accountId: input.accountId,
      date: input.date,
      amount: input.amount,
      normalizedLabel: normalized,
    }),
  }
}

// ---------------------------------------------------------------------------
// Créer ou modifier une opération
// ---------------------------------------------------------------------------

export async function saveTransactionAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(transactionSchema, {
    direction: formString(formData, 'direction'),
    amount: formString(formData, 'amount'),
    transactionDate: formString(formData, 'transactionDate'),
    label: formString(formData, 'label'),
    bankAccountId: formString(formData, 'bankAccountId'),
    categoryId: formString(formData, 'categoryId'),
    memberUserId: formString(formData, 'memberUserId'),
    status: formString(formData, 'status') || 'cleared',
    paymentMethod: formString(formData, 'paymentMethod'),
    notes: formString(formData, 'notes'),
  })

  if (!validation.success) return validation.state

  const { supabase, user, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const values = validation.data
  const transactionId = formString(formData, 'transactionId')

  // Convention de signe : négatif = sortie d'argent. L'utilisateur saisit
  // toujours un montant positif et choisit le sens.
  const signedAmount =
    values.direction === 'expense' ? -values.amount : values.amount

  const derived = derivedLabelFields({
    label: values.label,
    accountId: values.bankAccountId,
    date: values.transactionDate,
    amount: signedAmount,
  })

  const payload = {
    bank_account_id: values.bankAccountId,
    transaction_date: values.transactionDate,
    label: values.label,
    amount: signedAmount,
    transaction_type: values.direction,
    category_id: values.categoryId,
    member_user_id: values.memberUserId,
    status: values.status,
    payment_method: values.paymentMethod ?? null,
    notes: values.notes,
    ...derived,
  }

  if (transactionId) {
    const { data, error } = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', transactionId)
      .eq('household_id', active.household.id)
      .select('id')

    if (error) return errorState(translateDbError(error.message))
    if (!data || data.length === 0) {
      return errorState('Cette opération n’existe plus, ou vous n’avez pas le droit de la modifier.')
    }

    revalidatePath('/operations')
    revalidatePath('/tableau-de-bord')
    return successState('Opération modifiée.')
  }

  const { error } = await supabase.from('transactions').insert({
    ...payload,
    household_id: active.household.id,
    user_id: user.id,
    source: 'manual',
  })

  if (error) return errorState(translateDbError(error.message))

  revalidatePath('/operations')
  revalidatePath('/tableau-de-bord')
  return successState('Opération enregistrée.')
}

// ---------------------------------------------------------------------------
// Virement interne entre deux comptes du foyer (§12)
// ---------------------------------------------------------------------------

export async function saveTransferAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(transferSchema, {
    amount: formString(formData, 'amount'),
    transactionDate: formString(formData, 'transactionDate'),
    label: formString(formData, 'label'),
    fromAccountId: formString(formData, 'fromAccountId'),
    toAccountId: formString(formData, 'toAccountId'),
    notes: formString(formData, 'notes'),
  })

  if (!validation.success) return validation.state

  const { supabase, user, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const values = validation.data

  // La catégorie « Transfert interne » sert à exclure ces mouvements des
  // totaux de revenus et de dépenses.
  const { data: transferCategory } = await supabase
    .from('categories')
    .select('id')
    .eq('household_id', active.household.id)
    .eq('category_type', 'transfer')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  // Les deux moitiés partagent un identifiant de groupe : c'est ce qui permet
  // de les afficher liées et de les supprimer ensemble.
  const transferGroupId = crypto.randomUUID()

  const shared = {
    household_id: active.household.id,
    user_id: user.id,
    transaction_date: values.transactionDate,
    label: values.label,
    transaction_type: 'internal_transfer' as const,
    category_id: transferCategory?.id ?? null,
    status: 'cleared' as const,
    source: 'manual' as const,
    payment_method: 'transfer' as const,
    transfer_group_id: transferGroupId,
    notes: values.notes,
  }

  const { error } = await supabase.from('transactions').insert([
    {
      ...shared,
      bank_account_id: values.fromAccountId,
      amount: -values.amount,
      ...derivedLabelFields({
        label: values.label,
        accountId: values.fromAccountId,
        date: values.transactionDate,
        amount: -values.amount,
      }),
    },
    {
      ...shared,
      bank_account_id: values.toAccountId,
      amount: values.amount,
      ...derivedLabelFields({
        label: values.label,
        accountId: values.toAccountId,
        date: values.transactionDate,
        amount: values.amount,
      }),
    },
  ])

  if (error) return errorState(translateDbError(error.message))

  revalidatePath('/operations')
  revalidatePath('/comptes')
  revalidatePath('/tableau-de-bord')
  return successState('Virement enregistré sur les deux comptes.')
}

// ---------------------------------------------------------------------------
// Supprimer
// ---------------------------------------------------------------------------

export async function deleteTransactionAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(transactionIdSchema, {
    transactionId: formString(formData, 'transactionId'),
  })

  if (!validation.success) return validation.state

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const { data: transaction } = await supabase
    .from('transactions')
    .select('transfer_group_id')
    .eq('id', validation.data.transactionId)
    .eq('household_id', active.household.id)
    .maybeSingle()

  if (!transaction) return errorState('Cette opération n’existe plus.')

  // Supprimer une seule moitié d'un virement laisserait les soldes faux :
  // les deux lignes partent ensemble.
  const query = supabase.from('transactions').delete().eq('household_id', active.household.id)

  const { data, error } = transaction.transfer_group_id
    ? await query.eq('transfer_group_id', transaction.transfer_group_id).select('id')
    : await query.eq('id', validation.data.transactionId).select('id')

  if (error) return errorState(translateDbError(error.message))
  if (!data || data.length === 0) {
    return errorState('Cette opération n’existe plus, ou vous n’avez pas le droit de la supprimer.')
  }

  revalidatePath('/operations')
  revalidatePath('/comptes')
  revalidatePath('/tableau-de-bord')
  return successState(
    data.length > 1 ? 'Virement supprimé sur les deux comptes.' : 'Opération supprimée.',
  )
}
