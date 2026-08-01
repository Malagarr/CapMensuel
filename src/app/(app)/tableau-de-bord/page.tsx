import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, ArrowRight, TrendingUp } from 'lucide-react'

import { MonthPicker } from '@/app/(app)/tableau-de-bord/month-picker'
import { Alert } from '@/components/ui/alert'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Gauge } from '@/components/ui/gauge'
import {
  computeMonthlyTotals,
  forecastMonthEnd,
  type TransactionForDashboard,
} from '@/lib/dashboard'
import { formatDate, formatMoney, formatPercent } from '@/lib/format'
import { requireActiveHousehold } from '@/lib/household'
import { occurrencesUntil } from '@/lib/recurrence'
import { createClient } from '@/lib/supabase/server'
import { roundMoney } from '@/lib/utils'

export const metadata: Metadata = { title: 'Tableau de bord' }

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

export default async function DashboardPage({
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

  const today = new Date()
  const params = await searchParams
  const { year, month } = parseMonthParam(params.mois, today)
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const { start, end } = monthBounds(year, month)

  const [
    { data: categories },
    { data: transactions },
    { data: balances },
    { data: accounts },
    { data: recurrings },
  ] = await Promise.all([
    supabase
      .from('categories')
      .select('id, category_type')
      .eq('household_id', household.id),
    supabase
      .from('transactions')
      .select('amount, transaction_date, status, category_id, transaction_type')
      .eq('household_id', household.id)
      .neq('transaction_type', 'internal_transfer')
      .gte('transaction_date', start)
      .lte('transaction_date', end),
    supabase
      .from('account_balances')
      .select('current_balance, household_id')
      .eq('household_id', household.id),
    supabase
      .from('bank_accounts')
      .select('id, currency, is_active')
      .eq('household_id', household.id)
      .eq('is_active', true),
    supabase
      .from('recurring_transactions')
      .select('next_date, frequency, day_of_month, end_date, transaction_type, expected_amount')
      .eq('household_id', household.id)
      .eq('is_active', true),
  ])

  const categoryKindById = new Map((categories ?? []).map((c) => [c.id, c.category_type]))

  const dashboardTransactions: TransactionForDashboard[] = (transactions ?? []).map((t) => ({
    amount: Number(t.amount),
    transactionDate: t.transaction_date,
    status: t.status,
    categoryKind: t.category_id ? (categoryKindById.get(t.category_id) ?? null) : null,
  }))

  const totals = computeMonthlyTotals(dashboardTransactions, year, month, today)

  // Solde actuel : seulement si tous les comptes actifs partagent la devise
  // du foyer, sinon additionner n'aurait pas de sens.
  const singleCurrency = (accounts ?? []).every((a) => a.currency === household.currency)
  const currentBalance = singleCurrency
    ? roundMoney((balances ?? []).reduce((sum, b) => sum + Number(b.current_balance), 0))
    : null

  // Prévision : n'a de sens que pour le mois en cours. Les échéances futures
  // sont recalculées directement depuis les récurrences actives, plutôt que
  // de dépendre des opérations « prévues » déjà préparées par l'utilisateur.
  let forecast: ReturnType<typeof forecastMonthEnd> | null = null
  if (isCurrentMonth && currentBalance !== null) {
    const todayIso = today.toISOString().slice(0, 10)
    let remainingPlannedIncome = 0
    let remainingPlannedFixedExpenses = 0

    for (const recurring of recurrings ?? []) {
      const dates = occurrencesUntil(recurring.next_date, end, recurring.frequency, {
        dayOfMonth: recurring.day_of_month,
        end: recurring.end_date,
      })
      const upcoming = dates.filter((date) => date >= todayIso)
      if (upcoming.length === 0) continue

      const amount = roundMoney(Math.abs(Number(recurring.expected_amount)) * upcoming.length)
      if (recurring.transaction_type === 'income') {
        remainingPlannedIncome = roundMoney(remainingPlannedIncome + amount)
      } else if (recurring.transaction_type === 'expense') {
        remainingPlannedFixedExpenses = roundMoney(remainingPlannedFixedExpenses + amount)
      }
    }

    forecast = forecastMonthEnd({
      currentBalance,
      remainingPlannedIncome,
      remainingPlannedFixedExpenses,
      variableExpensesSoFar: roundMoney(
        totals.depensesVariablesRealisees + totals.depensesExceptionnellesRealisees,
      ),
      daysElapsed: totals.daysElapsed,
      daysRemaining: totals.daysRemaining,
    })
  }

  const gaugeRatio = Number.isFinite(totals.tauxUtilisation) ? totals.tauxUtilisation : 1.5

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{household.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Vue d’ensemble du mois sélectionné.</p>
        </div>
        <MonthPicker year={year} month={month} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenus"
          value={formatMoney(totals.revenusRealises, household.currency)}
          hint={
            totals.revenusPrevus !== totals.revenusRealises
              ? `${formatMoney(totals.revenusPrevus, household.currency)} prévus`
              : 'reçus ce mois-ci'
          }
          tone="income"
        />
        <StatCard
          label="Dépenses"
          value={formatMoney(totals.totalDepensesRealisees, household.currency)}
          hint={`${formatMoney(totals.chargesFixesPrevues, household.currency)} de charges fixes prévues`}
          tone="expense"
        />
        <StatCard
          label="Épargne"
          value={formatMoney(totals.epargneRealisee, household.currency)}
          hint="versée ce mois-ci"
        />
        <StatCard
          label="Reste à vivre"
          value={formatMoney(totals.resteAVivre, household.currency)}
          hint="revenus moins charges fixes, sur le mois entier"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Budget mensuel utilisé"
            description="Dépenses et épargne réalisées, rapportées aux revenus prévus du mois."
          />
          <CardBody className="pt-3">
            <Gauge
              label="Budget mensuel"
              value={totals.totalDepensesRealisees + totals.epargneRealisee}
              max={totals.revenusPrevus}
            />
            <p className="mt-3 text-sm text-muted-foreground">
              {Number.isFinite(totals.tauxUtilisation)
                ? `${formatPercent(gaugeRatio)} du revenu prévu déjà utilisé.`
                : 'Aucun revenu enregistré ce mois-ci pour calculer ce taux.'}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Reste disponible"
            description={`Sur les ${totals.daysRemaining} jour${totals.daysRemaining > 1 ? 's' : ''} restant${totals.daysRemaining > 1 ? 's' : ''} du mois.`}
          />
          <CardBody className="pt-3">
            <p className="tabular text-3xl font-bold">
              {formatMoney(totals.resteDisponible, household.currency)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              soit{' '}
              <span className="tabular font-semibold text-foreground">
                {formatMoney(totals.resteDisponibleParJour, household.currency)}
              </span>{' '}
              par jour
            </p>
          </CardBody>
        </Card>
      </div>

      {isCurrentMonth && (
        <Card>
          <CardHeader
            title="Prévision de fin de mois"
            description="Une estimation, pas un engagement : elle change avec votre rythme de dépense."
          />
          <CardBody className="pt-3">
            {currentBalance === null ? (
              <Alert tone="info">
                Cette estimation suppose que tous vos comptes actifs partagent la même
                devise.
              </Alert>
            ) : forecast ? (
              <Alert
                tone={forecast.risqueDecouvert ? 'warning' : 'success'}
                title={
                  forecast.risqueDecouvert
                    ? 'Risque de découvert avant la fin du mois'
                    : 'À votre rythme actuel'
                }
              >
                <p className="flex items-start gap-2">
                  {forecast.risqueDecouvert ? (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <TrendingUp className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    Votre solde estimé au {formatDate(monthBounds(year, month).end)} sera de{' '}
                    <strong className="tabular">
                      {formatMoney(forecast.soldeEstime, household.currency)}
                    </strong>
                    .
                  </span>
                </p>
              </Alert>
            ) : null}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="Charges fixes" value={totals.chargesFixesRealisees} currency={household.currency} />
        <MiniStat
          label="Dépenses variables"
          value={totals.depensesVariablesRealisees}
          currency={household.currency}
        />
        <MiniStat
          label="Dépenses exceptionnelles"
          value={totals.depensesExceptionnellesRealisees}
          currency={household.currency}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/operations" className={buttonClasses({ variant: 'outline' })}>
          Voir les opérations
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
        <Link href="/budgets" className={buttonClasses({ variant: 'outline' })}>
          Gérer les budgets
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
        <Link href="/statistiques" className={buttonClasses({ variant: 'outline' })}>
          Voir les statistiques
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone?: 'income' | 'expense'
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`tabular mt-1 text-2xl font-bold ${
            tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : ''
          }`}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardBody>
    </Card>
  )
}

function MiniStat({
  label,
  value,
  currency,
}: {
  label: string
  value: number
  currency: string
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="tabular mt-1 text-xl font-semibold">{formatMoney(value, currency)}</p>
      </CardBody>
    </Card>
  )
}
