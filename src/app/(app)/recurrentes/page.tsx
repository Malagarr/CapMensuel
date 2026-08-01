import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import {
  RecurringManager,
  type RecurringRow,
} from '@/app/(app)/recurrentes/recurring-manager'
import type {
  AccountOption,
  CategoryOption,
} from '@/app/(app)/operations/transaction-form'
import { Alert } from '@/components/ui/alert'
import { requireActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Opérations récurrentes' }

export default async function RecurringPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const { household, role } = await requireActiveHousehold(user)
  const writable = canWrite(role)

  const [{ data: recurrings }, { data: accounts }, { data: categories }] = await Promise.all([
    supabase
      .from('recurring_transactions')
      .select('*')
      .eq('household_id', household.id)
      .order('next_date', { ascending: true }),
    supabase
      .from('bank_accounts')
      .select('id, name, currency, is_active')
      .eq('household_id', household.id)
      .order('name'),
    supabase
      .from('categories')
      .select('id, name, category_type, color, icon, parent_category_id, is_active')
      .eq('household_id', household.id)
      .order('sort_order')
      .order('name'),
  ])

  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]))
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]))

  const accountOptions: AccountOption[] = (accounts ?? [])
    .filter((a) => a.is_active)
    .map((a) => ({ id: a.id, name: a.name, currency: a.currency }))

  const categoryOptions: CategoryOption[] = (categories ?? [])
    .filter((c) => c.is_active)
    .map((c) => ({
      id: c.id,
      name: c.name,
      categoryType: c.category_type,
      parentName: c.parent_category_id
        ? (categoryById.get(c.parent_category_id)?.name ?? null)
        : null,
    }))

  const rows: RecurringRow[] = (recurrings ?? []).map((recurring) => {
    const account = accountById.get(recurring.account_id)
    const category = recurring.category_id
      ? categoryById.get(recurring.category_id)
      : undefined

    return {
      id: recurring.id,
      label: recurring.label,
      expectedAmount: Number(recurring.expected_amount),
      currency: account?.currency ?? household.currency,
      direction: recurring.transaction_type === 'income' ? 'income' : 'expense',
      accountId: recurring.account_id,
      accountName: account?.name ?? 'Compte supprimé',
      categoryId: recurring.category_id,
      categoryName: category?.name ?? null,
      categoryColor: category?.color ?? null,
      categoryIcon: category?.icon ?? null,
      frequency: recurring.frequency,
      dayOfMonth: recurring.day_of_month,
      nextDate: recurring.next_date,
      endDate: recurring.end_date,
      amountIsVariable: recurring.amount_is_variable,
      beneficiary: recurring.beneficiary,
      isActive: recurring.is_active,
    }
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Opérations récurrentes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Loyer, assurances, abonnements, salaire : déclarés une fois, préparés
          automatiquement chaque échéance.
        </p>
      </div>

      {accountOptions.length === 0 ? (
        <Alert tone="warning" title="Créez d’abord un compte">
          Une opération récurrente doit être rattachée à un compte bancaire.
        </Alert>
      ) : (
        <RecurringManager
          recurrings={rows}
          accounts={accountOptions}
          categories={categoryOptions}
          canWrite={writable}
        />
      )}
    </div>
  )
}
