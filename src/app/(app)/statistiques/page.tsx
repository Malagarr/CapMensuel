import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { TrendingDown, TrendingUp } from 'lucide-react'

import { MonthPicker } from '@/app/(app)/tableau-de-bord/month-picker'
import {
  CategoryPieChart,
  IncomeExpenseBarChart,
  type CategorySlice,
  type MonthlySeriesPoint,
} from '@/app/(app)/statistiques/charts'
import { Alert } from '@/components/ui/alert'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { capitalize, formatMoney, formatPercent } from '@/lib/format'
import { requireActiveHousehold } from '@/lib/household'
import { createClient } from '@/lib/supabase/server'
import { roundMoney } from '@/lib/utils'

export const metadata: Metadata = { title: 'Statistiques' }

/** Nombre de mois affichés dans le graphique d'évolution. */
const MONTHS_HISTORY = 6

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

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = (year * 12 + (month - 1)) + delta
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 }
}

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const { household } = await requireActiveHousehold(user)

  const params = await searchParams
  const { year, month } = parseMonthParam(params.mois, new Date())
  const { start, end } = monthBounds(year, month)

  // Fenêtre couvrant les MONTHS_HISTORY derniers mois, pour le graphique
  // d'évolution et la comparaison avec le mois précédent.
  const oldest = shiftMonth(year, month, -(MONTHS_HISTORY - 1))
  const historyStart = monthBounds(oldest.year, oldest.month).start

  const [{ data: categories }, { data: monthTransactions }, { data: historyTransactions }] =
    await Promise.all([
      supabase
        .from('categories')
        .select('id, name, category_type, color')
        .eq('household_id', household.id),
      supabase
        .from('transactions')
        .select('amount, category_id')
        .eq('household_id', household.id)
        .eq('status', 'cleared')
        .neq('transaction_type', 'internal_transfer')
        .gte('transaction_date', start)
        .lte('transaction_date', end),
      supabase
        .from('transactions')
        .select('amount, transaction_date')
        .eq('household_id', household.id)
        .eq('status', 'cleared')
        .neq('transaction_type', 'internal_transfer')
        .gte('transaction_date', historyStart)
        .lte('transaction_date', end),
    ])

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]))

  // Répartition des dépenses du mois sélectionné, par catégorie.
  const spentByCategory = new Map<string, number>()
  for (const t of monthTransactions ?? []) {
    const amount = Number(t.amount)
    if (amount >= 0 || !t.category_id) continue
    spentByCategory.set(
      t.category_id,
      roundMoney((spentByCategory.get(t.category_id) ?? 0) + Math.abs(amount)),
    )
  }

  const pieData: CategorySlice[] = [...spentByCategory.entries()]
    .map(([categoryId, value]) => {
      const category = categoryById.get(categoryId)
      return { name: category?.name ?? 'Sans catégorie', value, color: category?.color ?? '#94A3B8' }
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 8) // au-delà, le camembert devient illisible : le reste importe peu visuellement

  // Évolution mensuelle revenus / dépenses sur MONTHS_HISTORY mois.
  const monthlyTotals = new Map<string, { revenus: number; depenses: number }>()
  for (let i = 0; i < MONTHS_HISTORY; i++) {
    const { year: y, month: m } = shiftMonth(year, month, -(MONTHS_HISTORY - 1) + i)
    monthlyTotals.set(`${y}-${String(m).padStart(2, '0')}`, { revenus: 0, depenses: 0 })
  }

  for (const t of historyTransactions ?? []) {
    const key = t.transaction_date.slice(0, 7)
    const bucket = monthlyTotals.get(key)
    if (!bucket) continue
    const amount = Number(t.amount)
    if (amount >= 0) bucket.revenus = roundMoney(bucket.revenus + amount)
    else bucket.depenses = roundMoney(bucket.depenses + Math.abs(amount))
  }

  const barData: MonthlySeriesPoint[] = [...monthlyTotals.entries()].map(([key, totals]) => {
    const [y, m] = key.split('-').map(Number)
    return {
      month: capitalize(new Date(y!, m! - 1, 1).toLocaleDateString('fr-FR', { month: 'short' })),
      ...totals,
    }
  })

  // Comparaison avec le mois précédent (§16).
  const currentKey = `${year}-${String(month).padStart(2, '0')}`
  const previous = shiftMonth(year, month, -1)
  const previousKey = `${previous.year}-${String(previous.month).padStart(2, '0')}`
  const currentExpenses = monthlyTotals.get(currentKey)?.depenses ?? 0
  const previousExpenses = monthlyTotals.get(previousKey)?.depenses

  const totalExpensesThisMonth = roundMoney(
    [...spentByCategory.values()].reduce((sum, v) => sum + v, 0),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statistiques</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            La répartition de vos dépenses et l’évolution de votre budget.
          </p>
        </div>
        <MonthPicker year={year} month={month} />
      </div>

      {previousExpenses !== undefined && previousExpenses > 0 && (
        <Alert tone={currentExpenses <= previousExpenses ? 'success' : 'warning'}>
          <span className="inline-flex items-center gap-1.5">
            {currentExpenses <= previousExpenses ? (
              <TrendingDown className="size-4" aria-hidden="true" />
            ) : (
              <TrendingUp className="size-4" aria-hidden="true" />
            )}
            Dépenses {currentExpenses <= previousExpenses ? 'en baisse' : 'en hausse'} de{' '}
            {formatPercent(Math.abs(currentExpenses - previousExpenses) / previousExpenses)} par
            rapport au mois précédent ({formatMoney(previousExpenses, household.currency)}).
          </span>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Dépenses par catégorie"
            description={
              totalExpensesThisMonth > 0
                ? `${formatMoney(totalExpensesThisMonth, household.currency)} au total ce mois-ci`
                : undefined
            }
          />
          <CardBody className="pt-3">
            <CategoryPieChart data={pieData} currency={household.currency} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Évolution mensuelle"
            description={`Revenus et dépenses des ${MONTHS_HISTORY} derniers mois.`}
          />
          <CardBody className="pt-3">
            <IncomeExpenseBarChart data={barData} currency={household.currency} />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
