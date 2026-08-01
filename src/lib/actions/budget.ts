'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { errorState, formString, successState, validateForm, type FormState } from '@/lib/forms'
import { getActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { saveBudgetSchema } from '@/lib/validation/budget'

async function requireWriteAccess() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const active = await getActiveHousehold(user)
  if (!active) redirect('/bienvenue')

  return { supabase, active, allowed: canWrite(active.role) }
}

const READ_ONLY_MESSAGE =
  'Votre rôle est « lecture seule » : vous ne pouvez pas modifier les budgets.'

/**
 * Crée ou met à jour le budget d'une catégorie pour un mois (§8).
 *
 * Une seule action pour les deux cas : la contrainte d'unicité
 * (household_id, category_id, year, month) fait que l'upsert choisit de
 * lui-même entre création et mise à jour.
 */
export async function saveBudgetAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(saveBudgetSchema, {
    categoryId: formString(formData, 'categoryId'),
    year: formString(formData, 'year'),
    month: formString(formData, 'month'),
    plannedAmount: formString(formData, 'plannedAmount'),
  })

  if (!validation.success) return validation.state

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const { categoryId, year, month, plannedAmount } = validation.data

  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('household_id', active.household.id)
    .maybeSingle()

  if (!category) return errorState('Cette catégorie n’existe plus.')

  const { error } = await supabase.from('category_budgets').upsert(
    {
      household_id: active.household.id,
      category_id: categoryId,
      year,
      month,
      planned_amount: plannedAmount,
    },
    { onConflict: 'household_id,category_id,year,month' },
  )

  if (error) {
    return errorState('Une erreur est survenue. Merci de réessayer.')
  }

  revalidatePath('/budgets')
  revalidatePath('/tableau-de-bord')
  return successState('Budget enregistré.')
}

/** Retire le budget d'une catégorie pour un mois (revient à « non défini »). */
export async function deleteBudgetAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const categoryId = formString(formData, 'categoryId')
  const year = Number(formString(formData, 'year'))
  const month = Number(formString(formData, 'month'))

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const { data, error } = await supabase
    .from('category_budgets')
    .delete()
    .eq('household_id', active.household.id)
    .eq('category_id', categoryId)
    .eq('year', year)
    .eq('month', month)
    .select('id')

  if (error) return errorState('Une erreur est survenue.')
  if (!data || data.length === 0) return errorState('Ce budget n’existe plus.')

  revalidatePath('/budgets')
  revalidatePath('/tableau-de-bord')
  return successState('Budget retiré.')
}

/**
 * Copie les budgets d'un mois vers un autre.
 *
 * Évite de ressaisir chaque catégorie tous les mois : on reprend simplement
 * les montants du mois précédent, modifiables ensuite un par un.
 */
export async function copyBudgetsFromPreviousMonthAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const year = Number(formString(formData, 'year'))
  const month = Number(formString(formData, 'month'))

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return errorState('Mois invalide.')
  }

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const previousMonth = month === 1 ? 12 : month - 1
  const previousYear = month === 1 ? year - 1 : year

  const { data: previousBudgets } = await supabase
    .from('category_budgets')
    .select('category_id, planned_amount')
    .eq('household_id', active.household.id)
    .eq('year', previousYear)
    .eq('month', previousMonth)

  if (!previousBudgets || previousBudgets.length === 0) {
    return errorState('Le mois précédent n’a aucun budget à copier.')
  }

  const { error } = await supabase.from('category_budgets').upsert(
    previousBudgets.map((budget) => ({
      household_id: active.household.id,
      category_id: budget.category_id,
      year,
      month,
      planned_amount: budget.planned_amount,
    })),
    { onConflict: 'household_id,category_id,year,month' },
  )

  if (error) return errorState('La copie a échoué. Merci de réessayer.')

  revalidatePath('/budgets')
  return successState(`${previousBudgets.length} budget${previousBudgets.length > 1 ? 's' : ''} copié${previousBudgets.length > 1 ? 's' : ''}.`)
}
