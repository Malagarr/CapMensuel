'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { errorState, formString, successState, validateForm, type FormState } from '@/lib/forms'
import { getActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { categoryIdSchema, categorySchema } from '@/lib/validation/category'

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
  'Votre rôle est « lecture seule » : vous ne pouvez pas modifier les catégories.'

function translateDbError(message: string): string {
  const normalized = message.toLowerCase()

  // Index categories_unique_name_idx : un même nom au même niveau.
  if (normalized.includes('categories_unique_name') || normalized.includes('duplicate key')) {
    return 'Une catégorie porte déjà ce nom à ce niveau. Choisissez-en un autre.'
  }
  if (normalized.includes('row-level security') || normalized.includes('permission')) {
    return READ_ONLY_MESSAGE
  }
  return 'Une erreur est survenue. Merci de réessayer.'
}

// ---------------------------------------------------------------------------
// Créer ou modifier
// ---------------------------------------------------------------------------

export async function saveCategoryAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(categorySchema, {
    name: formString(formData, 'name'),
    categoryType: formString(formData, 'categoryType'),
    icon: formString(formData, 'icon'),
    color: formString(formData, 'color'),
    parentCategoryId: formString(formData, 'parentCategoryId'),
  })

  if (!validation.success) return validation.state

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const categoryId = formString(formData, 'categoryId')
  const values = validation.data

  // Une catégorie ne peut pas être sa propre parente, ni descendre d'une
  // sous-catégorie : la hiérarchie est volontairement limitée à un niveau.
  if (values.parentCategoryId) {
    if (values.parentCategoryId === categoryId) {
      return errorState('Une catégorie ne peut pas être sa propre catégorie parente.')
    }

    const { data: parent } = await supabase
      .from('categories')
      .select('parent_category_id, household_id')
      .eq('id', values.parentCategoryId)
      .maybeSingle()

    if (!parent || parent.household_id !== active.household.id) {
      return errorState('Catégorie parente inconnue.')
    }
    if (parent.parent_category_id !== null) {
      return errorState(
        'Une sous-catégorie ne peut pas en contenir d’autres : un seul niveau est possible.',
      )
    }
  }

  const payload = {
    name: values.name,
    category_type: values.categoryType,
    icon: values.icon,
    color: values.color,
    parent_category_id: values.parentCategoryId,
  }

  if (categoryId) {
    // Si la catégorie a des enfants, elle ne peut pas devenir elle-même fille.
    if (values.parentCategoryId) {
      const { count } = await supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .eq('parent_category_id', categoryId)

      if ((count ?? 0) > 0) {
        return errorState(
          'Cette catégorie contient des sous-catégories : elle ne peut pas devenir elle-même une sous-catégorie.',
        )
      }
    }

    const { data, error } = await supabase
      .from('categories')
      .update(payload)
      .eq('id', categoryId)
      .eq('household_id', active.household.id)
      .select('id')

    if (error) return errorState(translateDbError(error.message))
    if (!data || data.length === 0) {
      return errorState('Cette catégorie n’existe plus, ou vous n’avez pas le droit de la modifier.')
    }

    revalidatePath('/categories')
    return successState('Catégorie mise à jour.')
  }

  const { error } = await supabase.from('categories').insert({
    ...payload,
    household_id: active.household.id,
  })

  if (error) return errorState(translateDbError(error.message))

  revalidatePath('/categories')
  return successState('Catégorie créée.')
}

// ---------------------------------------------------------------------------
// Archiver / réactiver
// ---------------------------------------------------------------------------

export async function toggleCategoryArchiveAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(categoryIdSchema, {
    categoryId: formString(formData, 'categoryId'),
  })

  if (!validation.success) return validation.state

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const { data: category } = await supabase
    .from('categories')
    .select('is_active, name')
    .eq('id', validation.data.categoryId)
    .eq('household_id', active.household.id)
    .maybeSingle()

  if (!category) return errorState('Cette catégorie n’existe plus.')

  const nextActive = !category.is_active

  // Archiver une catégorie parente archive aussi ses sous-catégories :
  // les laisser actives sous un parent invisible n'aurait aucun sens.
  const { data, error } = await supabase
    .from('categories')
    .update({ is_active: nextActive })
    .or(`id.eq.${validation.data.categoryId},parent_category_id.eq.${validation.data.categoryId}`)
    .eq('household_id', active.household.id)
    .select('id')

  if (error) return errorState(translateDbError(error.message))
  if (!data || data.length === 0) return errorState(READ_ONLY_MESSAGE)

  const extra = data.length > 1 ? ` (et ${data.length - 1} sous-catégorie${data.length > 2 ? 's' : ''})` : ''

  revalidatePath('/categories')
  return successState(
    nextActive ? `« ${category.name} » réactivée${extra}.` : `« ${category.name} » archivée${extra}.`,
  )
}

// ---------------------------------------------------------------------------
// Supprimer définitivement
// ---------------------------------------------------------------------------

export async function deleteCategoryAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(categoryIdSchema, {
    categoryId: formString(formData, 'categoryId'),
  })

  if (!validation.success) return validation.state

  const { supabase, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  // transactions.category_id est « on delete set null » : supprimer une
  // catégorie utilisée déclasserait silencieusement ses opérations. On refuse
  // et on oriente vers l'archivage, qui préserve l'historique.
  const [{ count: transactionCount }, { count: childCount }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', validation.data.categoryId),
    supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('parent_category_id', validation.data.categoryId),
  ])

  if ((transactionCount ?? 0) > 0) {
    return errorState(
      `Cette catégorie classe ${transactionCount} opération${(transactionCount ?? 0) > 1 ? 's' : ''} : ` +
        'la supprimer les laisserait sans catégorie. Archivez-la plutôt, elle disparaîtra ' +
        'des formulaires de saisie tout en conservant l’historique.',
    )
  }

  if ((childCount ?? 0) > 0) {
    return errorState(
      'Cette catégorie contient des sous-catégories. Supprimez-les d’abord, ou archivez la catégorie.',
    )
  }

  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', validation.data.categoryId)
    .eq('household_id', active.household.id)
    .select('id')

  if (error) return errorState(translateDbError(error.message))
  if (!data || data.length === 0) {
    return errorState('Cette catégorie n’existe plus, ou vous n’avez pas le droit de la supprimer.')
  }

  revalidatePath('/categories')
  return successState('Catégorie supprimée.')
}
