import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import {
  CategoriesManager,
  type CategoryRow,
} from '@/app/(app)/categories/categories-manager'
import { Alert } from '@/components/ui/alert'
import { requireActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Catégories' }

export default async function CategoriesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const { household, role } = await requireActiveHousehold(user)
  const writable = canWrite(role)

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('household_id', household.id)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  // Nombre d'opérations par catégorie : sert à savoir si la suppression est
  // possible, et à indiquer à l'utilisateur ce qu'il risque de perdre.
  const { data: usage } = await supabase
    .from('transactions')
    .select('category_id')
    .eq('household_id', household.id)
    .not('category_id', 'is', null)

  const usageCount = new Map<string, number>()
  for (const row of usage ?? []) {
    if (row.category_id) {
      usageCount.set(row.category_id, (usageCount.get(row.category_id) ?? 0) + 1)
    }
  }

  const rows: CategoryRow[] = (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    categoryType: category.category_type,
    icon: category.icon,
    color: category.color,
    parentCategoryId: category.parent_category_id,
    isActive: category.is_active,
    isSystem: category.is_system,
    transactionCount: usageCount.get(category.id) ?? 0,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Catégories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Elles déterminent comment vos opérations sont regroupées dans les budgets et
          les statistiques.
        </p>
      </div>

      {!writable && (
        <Alert tone="info">
          Votre rôle est « lecture seule » : vous pouvez consulter les catégories, mais
          pas les modifier.
        </Alert>
      )}

      <CategoriesManager categories={rows} canWrite={writable} />
    </div>
  )
}
