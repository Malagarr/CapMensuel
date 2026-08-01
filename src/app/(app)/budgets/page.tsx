import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { MonthPicker } from '@/app/(app)/tableau-de-bord/month-picker'
import { Alert } from '@/components/ui/alert'
import { Card, CardBody } from '@/components/ui/card'
import { BudgetRow, CopyBudgetsButton, type BudgetCategoryRow } from '@/app/(app)/budgets/budget-row'
import { categoryKindLabels, categoryKindOrder } from '@/lib/categories'
import { formatMoney } from '@/lib/format'
import { requireActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { roundMoney } from '@/lib/utils'
import type { CategoryKind } from '@/types/database'

export const metadata: Metadata = { title: 'Budgets' }

const BUDGETABLE_KINDS: CategoryKind[] = ['fixed_expense', 'variable_expense', 'exceptional_expense']

function parseMonthParam(value: string | undefined, fallback: Date): { year: number; month: number } {
  const match = value ? /^(\d{4})-(\d{2})$/.exec(value) : null
  if (!match) return { year: fallback.getFullYear(), month: fallback.getMonth() + 1 }
  const month = Number(match[2])
  if (month < 1 || month > 12) return { year: fallback.getFullYear(), month: fallback.getMonth() + 1 }
  return { year: Number(match[1]), month }
}

function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const { household, role } = await requireActiveHousehold(user)
  const writable = canWrite(role)

  const params = await searchParams
  const { year, month } = parseMonthParam(params.mois, new Date())
  const { start, end } = monthBounds(year, month)

  const [{ data: categories }, { data: budgets }, { data: transactions }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, category_type, color, icon, is_active')
      .eq('household_id', household.id)
      .eq('is_active', true)
      .in('category_type', BUDGETABLE_KINDS)
      .order('sort_order')
      .order('name'),
    supabase
      .from('category_budgets')
      .select('category_id, planned_amount')
      .eq('household_id', household.id)
      .eq('year', year)
      .eq('month', month),
    supabase
      .from('transactions')
      .select('amount, category_id, status')
      .eq('household_id', household.id)
      .in('status', ['cleared', 'pending'])
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .not('category_id', 'is', null),
  ])

  const plannedByCategory = new Map((budgets ?? []).map((b) => [b.category_id, Number(b.planned_amount)]))

  const spentByCategory = new Map<string, number>()
  for (const t of transactions ?? []) {
    if (!t.category_id || Number(t.amount) >= 0) continue // seules les dépenses comptent
    const current = spentByCategory.get(t.category_id) ?? 0
    spentByCategory.set(t.category_id, roundMoney(current + Math.abs(Number(t.amount))))
  }

  const rows: BudgetCategoryRow[] = (categories ?? []).map((category) => ({
    categoryId: category.id,
    categoryType: category.category_type,
    name: category.name,
    color: category.color,
    icon: category.icon,
    planned: plannedByCategory.get(category.id) ?? null,
    spent: spentByCategory.get(category.id) ?? 0,
    currency: household.currency,
  }))

  const totalPlanned = roundMoney(
    [...plannedByCategory.values()].reduce((sum, value) => sum + value, 0),
  )
  const totalSpent = roundMoney(
    [...spentByCategory.values()].reduce((sum, value) => sum + value, 0),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fixez un plafond par catégorie et suivez-le au fil du mois.
          </p>
        </div>
        <MonthPicker year={year} month={month} />
      </div>

      {!writable && (
        <Alert tone="info">
          Votre rôle est « lecture seule » : vous pouvez consulter les budgets, mais pas
          les modifier.
        </Alert>
      )}

      {totalPlanned > 0 && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Total des budgets définis</p>
              <p className="tabular text-xl font-bold">
                {formatMoney(totalSpent, household.currency)} sur{' '}
                {formatMoney(totalPlanned, household.currency)}
              </p>
            </div>
            {writable && (
              <CopyBudgetsButton year={year} month={month} />
            )}
          </CardBody>
        </Card>
      )}

      {totalPlanned === 0 && writable && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Aucun budget défini ce mois-ci. Définissez-en un catégorie par catégorie
              ci-dessous, ou reprenez ceux du mois précédent.
            </p>
            <CopyBudgetsButton year={year} month={month} />
          </CardBody>
        </Card>
      )}

      {categoryKindOrder
        .filter((kind) => BUDGETABLE_KINDS.includes(kind))
        .map((kind) => {
          const kindRows = rows.filter((row) => row.categoryType === kind)
          if (kindRows.length === 0) return null

          return (
            <Card key={kind}>
              <CardBody className="p-0">
                <h2 className="border-b border-border px-5 py-2.5 text-sm font-semibold">
                  {categoryKindLabels[kind]}
                </h2>
                <ul className="divide-y divide-border">
                  {kindRows.map((row) => (
                    <BudgetRow
                      key={row.categoryId}
                      category={row}
                      year={year}
                      month={month}
                      canWrite={writable}
                    />
                  ))}
                </ul>
              </CardBody>
            </Card>
          )
        })}

      {rows.length === 0 && (
        <Alert tone="info">
          Aucune catégorie de dépense n’existe encore. Créez-en depuis la page
          Catégories.
        </Alert>
      )}
    </div>
  )
}
