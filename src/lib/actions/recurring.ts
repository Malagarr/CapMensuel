'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { buildFingerprint, extractMerchant, normalizeLabel } from '@/lib/banking/normalize'
import { errorState, formString, successState, validateForm, type FormState } from '@/lib/forms'
import { getActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { nextOccurrence, occurrencesUntil } from '@/lib/recurrence'
import { createClient } from '@/lib/supabase/server'
import { recurringIdSchema, recurringSchema } from '@/lib/validation/recurring'
import type { TablesInsert } from '@/types/database'

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
  'Votre rôle est « lecture seule » : vous ne pouvez pas modifier les opérations récurrentes.'

// ---------------------------------------------------------------------------
// Créer ou modifier une récurrence
// ---------------------------------------------------------------------------

export async function saveRecurringAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(recurringSchema, {
    label: formString(formData, 'label'),
    direction: formString(formData, 'direction'),
    expectedAmount: formString(formData, 'expectedAmount'),
    accountId: formString(formData, 'accountId'),
    categoryId: formString(formData, 'categoryId'),
    frequency: formString(formData, 'frequency'),
    dayOfMonth: formString(formData, 'dayOfMonth'),
    nextDate: formString(formData, 'nextDate'),
    endDate: formString(formData, 'endDate'),
    amountIsVariable: formString(formData, 'amountIsVariable') || undefined,
    beneficiary: formString(formData, 'beneficiary'),
  })

  if (!validation.success) return validation.state

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const values = validation.data
  const recurringId = formString(formData, 'recurringId')

  // Même convention de signe que pour les opérations : négatif = sortie.
  const signedAmount =
    values.direction === 'expense' ? -values.expectedAmount : values.expectedAmount

  const payload = {
    label: values.label,
    expected_amount: signedAmount,
    transaction_type: values.direction,
    account_id: values.accountId,
    category_id: values.categoryId,
    frequency: values.frequency,
    day_of_month: values.dayOfMonth,
    next_date: values.nextDate,
    end_date: values.endDate,
    amount_is_variable: values.amountIsVariable,
    beneficiary: values.beneficiary,
  }

  if (recurringId) {
    const { data, error } = await supabase
      .from('recurring_transactions')
      .update(payload)
      .eq('id', recurringId)
      .eq('household_id', active.household.id)
      .select('id')

    if (error) return errorState('Une erreur est survenue. Merci de réessayer.')
    if (!data || data.length === 0) return errorState('Cette récurrence n’existe plus.')

    revalidatePath('/recurrentes')
    return successState('Opération récurrente mise à jour.')
  }

  const { error } = await supabase.from('recurring_transactions').insert({
    ...payload,
    household_id: active.household.id,
    start_date: values.nextDate,
  })

  if (error) return errorState('Une erreur est survenue. Merci de réessayer.')

  revalidatePath('/recurrentes')
  return successState('Opération récurrente créée.')
}

// ---------------------------------------------------------------------------
// Activer / suspendre
// ---------------------------------------------------------------------------

export async function toggleRecurringAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(recurringIdSchema, {
    recurringId: formString(formData, 'recurringId'),
  })

  if (!validation.success) return validation.state

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const { data: recurring } = await supabase
    .from('recurring_transactions')
    .select('is_active')
    .eq('id', validation.data.recurringId)
    .eq('household_id', active.household.id)
    .maybeSingle()

  if (!recurring) return errorState('Cette récurrence n’existe plus.')

  const { error } = await supabase
    .from('recurring_transactions')
    .update({ is_active: !recurring.is_active })
    .eq('id', validation.data.recurringId)
    .eq('household_id', active.household.id)

  if (error) return errorState('Une erreur est survenue.')

  revalidatePath('/recurrentes')
  return successState(recurring.is_active ? 'Récurrence suspendue.' : 'Récurrence réactivée.')
}

// ---------------------------------------------------------------------------
// Supprimer
// ---------------------------------------------------------------------------

export async function deleteRecurringAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(recurringIdSchema, {
    recurringId: formString(formData, 'recurringId'),
  })

  if (!validation.success) return validation.state

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  // Les opérations déjà générées ne sont pas supprimées : leur lien est
  // simplement rompu (« on delete set null »). L'historique reste intact.
  const { data, error } = await supabase
    .from('recurring_transactions')
    .delete()
    .eq('id', validation.data.recurringId)
    .eq('household_id', active.household.id)
    .select('id')

  if (error) return errorState('Une erreur est survenue.')
  if (!data || data.length === 0) return errorState('Cette récurrence n’existe plus.')

  revalidatePath('/recurrentes')
  return successState('Récurrence supprimée. Les opérations déjà créées sont conservées.')
}

// ---------------------------------------------------------------------------
// Préparer les opérations à venir (§13)
// ---------------------------------------------------------------------------

/** Horizon de génération : les échéances des 45 prochains jours. */
const HORIZON_DAYS = 45

export async function generatePlannedOperationsAction(
  _previousState: FormState,
  _formData: FormData,
): Promise<FormState> {
  const { supabase, user, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const today = new Date()
  const horizonDate = new Date(today)
  horizonDate.setUTCDate(horizonDate.getUTCDate() + HORIZON_DAYS)
  const horizon = horizonDate.toISOString().slice(0, 10)

  const { data: recurrings } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('household_id', active.household.id)
    .eq('is_active', true)
    .lte('next_date', horizon)

  if (!recurrings || recurrings.length === 0) {
    return successState('Aucune échéance à préparer dans les 45 prochains jours.')
  }

  // Opérations déjà générées : on ne recrée pas ce qui existe. La double
  // exécution de cette action doit être sans effet.
  const { data: existing } = await supabase
    .from('transactions')
    .select('recurring_transaction_id, transaction_date')
    .eq('household_id', active.household.id)
    .not('recurring_transaction_id', 'is', null)

  const alreadyCreated = new Set(
    (existing ?? []).map((row) => `${row.recurring_transaction_id}|${row.transaction_date}`),
  )

  const toInsert: TablesInsert<'transactions'>[] = []
  const nextDates = new Map<string, string | null>()

  for (const recurring of recurrings) {
    const dates = occurrencesUntil(recurring.next_date, horizon, recurring.frequency, {
      dayOfMonth: recurring.day_of_month,
      end: recurring.end_date,
    })

    for (const date of dates) {
      if (alreadyCreated.has(`${recurring.id}|${date}`)) continue

      const normalized = normalizeLabel(recurring.label)
      const amount = Number(recurring.expected_amount)

      toInsert.push({
        household_id: active.household.id,
        bank_account_id: recurring.account_id,
        user_id: user.id,
        transaction_date: date,
        label: recurring.label,
        normalized_label: normalized,
        merchant: extractMerchant(normalized) || null,
        amount,
        transaction_type: recurring.transaction_type,
        category_id: recurring.category_id,
        // Statut « prévue » : comptée dans la prévision de fin de mois, mais
        // pas dans le solde constaté tant que la banque n'a rien débité.
        status: 'planned',
        source: 'recurring',
        recurring_transaction_id: recurring.id,
        fingerprint: buildFingerprint({
          accountId: recurring.account_id,
          date,
          amount,
          normalizedLabel: normalized,
        }),
      })
    }

    // La prochaine échéance devient la première au-delà de l'horizon.
    const lastDate = dates.at(-1) ?? recurring.next_date
    const following = nextOccurrence(lastDate, recurring.frequency, recurring.day_of_month)
    nextDates.set(recurring.id, following)
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('transactions').insert(toInsert)
    if (error) {
      return errorState('Les opérations prévues n’ont pas pu être créées.')
    }
  }

  // Avancement des échéances. Une récurrence ponctuelle arrivée à son terme
  // est désactivée plutôt que supprimée : son historique reste consultable.
  for (const [recurringId, following] of nextDates) {
    if (following) {
      await supabase
        .from('recurring_transactions')
        .update({ next_date: following })
        .eq('id', recurringId)
        .eq('household_id', active.household.id)
    } else {
      await supabase
        .from('recurring_transactions')
        .update({ is_active: false })
        .eq('id', recurringId)
        .eq('household_id', active.household.id)
    }
  }

  revalidatePath('/recurrentes')
  revalidatePath('/operations')
  revalidatePath('/tableau-de-bord')

  if (toInsert.length === 0) {
    return successState('Tout est déjà à jour : aucune nouvelle échéance à préparer.')
  }

  return successState(
    `${toInsert.length} opération${toInsert.length > 1 ? 's' : ''} prévue${toInsert.length > 1 ? 's' : ''} ajoutée${toInsert.length > 1 ? 's' : ''} pour les ${HORIZON_DAYS} prochains jours.`,
  )
}
