'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { errorState, formString, successState, validateForm, type FormState } from '@/lib/forms'
import { getActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { matchesRule } from '@/lib/banking/categorize'
import { createClient } from '@/lib/supabase/server'
import { ruleIdSchema, ruleSchema } from '@/lib/validation/rule'

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
  'Votre rôle est « lecture seule » : vous ne pouvez pas modifier les règles de catégorisation.'

// ---------------------------------------------------------------------------
// Créer ou modifier
// ---------------------------------------------------------------------------

export async function saveRuleAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(ruleSchema, {
    ruleName: formString(formData, 'ruleName'),
    matchType: formString(formData, 'matchType'),
    matchValue: formString(formData, 'matchValue'),
    categoryId: formString(formData, 'categoryId'),
    accountId: formString(formData, 'accountId'),
    priority: formString(formData, 'priority'),
  })

  if (!validation.success) return validation.state

  const { supabase, user, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const values = validation.data
  const ruleId = formString(formData, 'ruleId')

  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('id', values.categoryId)
    .eq('household_id', active.household.id)
    .maybeSingle()

  if (!category) return errorState('Catégorie inconnue.')

  if (values.accountId) {
    const { data: account } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('id', values.accountId)
      .eq('household_id', active.household.id)
      .maybeSingle()

    if (!account) return errorState('Compte inconnu.')
  }

  const payload = {
    rule_name: values.ruleName,
    match_type: values.matchType,
    match_value: values.matchValue,
    category_id: values.categoryId,
    account_id: values.accountId,
    priority: values.priority,
  }

  if (ruleId) {
    const { data, error } = await supabase
      .from('categorization_rules')
      .update(payload)
      .eq('id', ruleId)
      .eq('household_id', active.household.id)
      .select('id')

    if (error) return errorState('Une erreur est survenue. Merci de réessayer.')
    if (!data || data.length === 0) {
      return errorState('Cette règle n’existe plus, ou vous n’avez pas le droit de la modifier.')
    }

    revalidatePath('/regles')
    return successState('Règle mise à jour.')
  }

  const { error } = await supabase.from('categorization_rules').insert({
    ...payload,
    household_id: active.household.id,
    created_by: user.id,
  })

  if (error) return errorState('Une erreur est survenue. Merci de réessayer.')

  revalidatePath('/regles')
  return successState('Règle créée.')
}

// ---------------------------------------------------------------------------
// Activer / désactiver
// ---------------------------------------------------------------------------

export async function toggleRuleActiveAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(ruleIdSchema, {
    ruleId: formString(formData, 'ruleId'),
  })

  if (!validation.success) return validation.state

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const { data: rule } = await supabase
    .from('categorization_rules')
    .select('is_active')
    .eq('id', validation.data.ruleId)
    .eq('household_id', active.household.id)
    .maybeSingle()

  if (!rule) return errorState('Cette règle n’existe plus.')

  const nextActive = !rule.is_active

  const { data, error } = await supabase
    .from('categorization_rules')
    .update({ is_active: nextActive })
    .eq('id', validation.data.ruleId)
    .eq('household_id', active.household.id)
    .select('id')

  if (error) return errorState('Une erreur est survenue.')
  if (!data || data.length === 0) return errorState(READ_ONLY_MESSAGE)

  revalidatePath('/regles')
  return successState(nextActive ? 'Règle réactivée.' : 'Règle désactivée.')
}

// ---------------------------------------------------------------------------
// Appliquer aux anciennes opérations (§10)
// ---------------------------------------------------------------------------

/**
 * Nombre maximal d'opérations non catégorisées reconsidérées en une fois.
 * Au-delà, l'utilisateur peut relancer l'action : elle ne traite jamais deux
 * fois la même opération, puisque seules celles encore sans catégorie sont
 * reprises.
 */
const MAX_OPERATIONS_RECONSIDERED = 5000

export async function applyRuleToPastAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(ruleIdSchema, {
    ruleId: formString(formData, 'ruleId'),
  })

  if (!validation.success) return validation.state

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const { data: rule } = await supabase
    .from('categorization_rules')
    .select('id, match_type, match_value, category_id, account_id, is_active, hit_count')
    .eq('id', validation.data.ruleId)
    .eq('household_id', active.household.id)
    .maybeSingle()

  if (!rule) return errorState('Cette règle n’existe plus.')
  if (!rule.is_active) {
    return errorState('Réactivez d’abord cette règle avant de l’appliquer aux anciennes opérations.')
  }

  // Seules les opérations encore sans catégorie sont reprises : une opération
  // déjà classée, même à la main, ne doit jamais être écrasée silencieusement.
  let query = supabase
    .from('transactions')
    .select('id, normalized_label')
    .eq('household_id', active.household.id)
    .is('category_id', null)
    .limit(MAX_OPERATIONS_RECONSIDERED)

  if (rule.account_id) {
    query = query.eq('bank_account_id', rule.account_id)
  }

  const { data: candidates, error: fetchError } = await query

  if (fetchError) return errorState('Une erreur est survenue. Merci de réessayer.')
  if (!candidates || candidates.length === 0) {
    return successState('Aucune opération sans catégorie ne correspond à cette règle.')
  }

  const matchingIds = candidates
    .filter((transaction) => matchesRule(transaction.normalized_label, rule.match_type, rule.match_value))
    .map((transaction) => transaction.id)

  if (matchingIds.length === 0) {
    return successState('Aucune opération sans catégorie ne correspond à cette règle.')
  }

  const { data: updated, error: updateError } = await supabase
    .from('transactions')
    .update({ category_id: rule.category_id, status: 'cleared' })
    .in('id', matchingIds)
    .eq('household_id', active.household.id)
    .select('id')

  if (updateError) return errorState('Une erreur est survenue. Merci de réessayer.')
  if (!updated || updated.length === 0) return errorState(READ_ONLY_MESSAGE)

  await supabase
    .from('categorization_rules')
    .update({ hit_count: rule.hit_count + updated.length })
    .eq('id', rule.id)
    .eq('household_id', active.household.id)

  revalidatePath('/regles')
  revalidatePath('/operations')
  revalidatePath('/tableau-de-bord')

  return successState(
    `${updated.length} opération${updated.length > 1 ? 's' : ''} classée${updated.length > 1 ? 's' : ''}.`,
  )
}
