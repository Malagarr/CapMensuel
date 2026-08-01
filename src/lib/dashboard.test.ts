import { describe, expect, it } from 'vitest'

import {
  computeCategoryBudgetStatus,
  computeMonthlyTotals,
  daysElapsedInMonth,
  forecastMonthEnd,
  type TransactionForDashboard,
} from '@/lib/dashboard'

function tx(
  amount: number,
  categoryKind: TransactionForDashboard['categoryKind'],
  status: TransactionForDashboard['status'] = 'cleared',
  date = '2026-07-15',
): TransactionForDashboard {
  return { amount, categoryKind, status, transactionDate: date }
}

describe('daysElapsedInMonth', () => {
  it('compte les jours écoulés dans le mois en cours', () => {
    expect(daysElapsedInMonth(2026, 7, new Date(2026, 6, 12))).toBe(12)
    expect(daysElapsedInMonth(2026, 7, new Date(2026, 6, 1))).toBe(1)
    expect(daysElapsedInMonth(2026, 7, new Date(2026, 6, 31))).toBe(31)
  })

  it('considère un mois passé comme entièrement écoulé', () => {
    expect(daysElapsedInMonth(2026, 6, new Date(2026, 6, 15))).toBe(30)
  })

  it('considère un mois futur comme entièrement écoulé (repli sûr)', () => {
    expect(daysElapsedInMonth(2026, 8, new Date(2026, 6, 15))).toBe(31)
  })
})

describe('computeMonthlyTotals', () => {
  it('traite l’exemple du cahier des charges (§4)', () => {
    // Revenus : 3 500 € ; Dépenses : 2 700 € ; Épargne : 300 € ;
    // Reste disponible : 500 €.
    const transactions: TransactionForDashboard[] = [
      tx(3500, 'income'),
      tx(-1800, 'fixed_expense'),
      tx(-700, 'variable_expense'),
      tx(-200, 'exceptional_expense'),
      tx(-300, 'savings'),
    ]

    const totals = computeMonthlyTotals(transactions, 2026, 7, new Date(2026, 6, 15))

    expect(totals.revenusRealises).toBe(3500)
    expect(totals.totalDepensesRealisees).toBe(2700)
    expect(totals.epargneRealisee).toBe(300)
    // reste à vivre = revenus - charges fixes = 3500 - 1800 = 1700
    expect(totals.resteAVivre).toBe(1700)
    // reste disponible = reste à vivre - variables - exceptionnelles - épargne
    // = 1700 - 700 - 200 - 300 = 500
    expect(totals.resteDisponible).toBe(500)
  })

  it('répartit le reste disponible sur les jours restants', () => {
    const transactions: TransactionForDashboard[] = [
      tx(2000, 'income'),
      tx(-1000, 'fixed_expense'),
      tx(-500, 'variable_expense'),
    ]

    // 31 juillet : le 15, il reste 17 jours (15 inclus).
    const totals = computeMonthlyTotals(transactions, 2026, 7, new Date(2026, 6, 15))
    expect(totals.daysRemaining).toBe(17)
    // reste disponible = (2000-1000) - 500 = 500 ; 500/17 ≈ 29,41
    expect(totals.resteDisponibleParJour).toBeCloseTo(29.41, 2)
  })

  it('ignore les opérations annulées ou rejetées', () => {
    const transactions: TransactionForDashboard[] = [
      tx(1000, 'income'),
      tx(-500, 'variable_expense', 'cancelled'),
      tx(-200, 'variable_expense', 'rejected'),
    ]

    const totals = computeMonthlyTotals(transactions, 2026, 7, new Date(2026, 6, 15))
    expect(totals.depensesVariablesRealisees).toBe(0)
  })

  it('compte les opérations en attente comme réalisées', () => {
    // Une carte à débit différé (§13) : payée mais pas encore débitée.
    const transactions: TransactionForDashboard[] = [
      tx(1000, 'income'),
      tx(-150, 'variable_expense', 'pending'),
    ]

    const totals = computeMonthlyTotals(transactions, 2026, 7, new Date(2026, 6, 15))
    expect(totals.depensesVariablesRealisees).toBe(150)
  })

  it('inclut les revenus et charges fixes prévus mais pas encore réalisés', () => {
    const transactions: TransactionForDashboard[] = [
      tx(2000, 'income', 'cleared'),
      tx(1000, 'income', 'planned'), // salaire à venir plus tard dans le mois
      tx(-800, 'fixed_expense', 'cleared'),
      tx(-800, 'fixed_expense', 'planned'), // loyer pas encore prélevé
    ]

    const totals = computeMonthlyTotals(transactions, 2026, 7, new Date(2026, 6, 5))
    expect(totals.revenusPrevus).toBe(3000)
    expect(totals.revenusRealises).toBe(2000)
    expect(totals.chargesFixesPrevues).toBe(1600)
    expect(totals.chargesFixesRealisees).toBe(800)
    // reste à vivre se base sur le mois entier : 3000 - 1600 = 1400
    expect(totals.resteAVivre).toBe(1400)
  })

  it('gère un mois sans aucune opération', () => {
    const totals = computeMonthlyTotals([], 2026, 7, new Date(2026, 6, 15))
    expect(totals.revenusPrevus).toBe(0)
    expect(totals.resteAVivre).toBe(0)
    expect(totals.resteDisponible).toBe(0)
    expect(totals.tauxUtilisation).toBe(0)
  })

  it('signale un taux d’utilisation supérieur à 100 % en cas de dépassement', () => {
    const transactions: TransactionForDashboard[] = [
      tx(1000, 'income'),
      tx(-1200, 'variable_expense'),
    ]
    const totals = computeMonthlyTotals(transactions, 2026, 7, new Date(2026, 6, 15))
    expect(totals.tauxUtilisation).toBeGreaterThan(1)
  })

  it('ne divise jamais par zéro sans revenu', () => {
    const transactions: TransactionForDashboard[] = [tx(-100, 'variable_expense')]
    const totals = computeMonthlyTotals(transactions, 2026, 7, new Date(2026, 6, 15))
    expect(totals.tauxUtilisation).toBe(Infinity)
    expect(Number.isFinite(totals.resteDisponibleParJour)).toBe(true)
  })
})

describe('forecastMonthEnd', () => {
  it('traite l’exemple du cahier des charges (§14)', () => {
    // « À votre rythme actuel, votre solde estimé au 31 août sera de 320 €. »
    const forecast = forecastMonthEnd({
      currentBalance: 500,
      remainingPlannedIncome: 0,
      remainingPlannedFixedExpenses: 0,
      variableExpensesSoFar: 180,
      daysElapsed: 10,
      daysRemaining: 21,
    })
    // rythme : 18€/jour × 21 jours restants = 378€ ; 500 - 378 = 122
    expect(forecast.soldeEstime).toBeCloseTo(122, 2)
    expect(forecast.risqueDecouvert).toBe(false)
  })

  it('signale un risque de découvert', () => {
    const forecast = forecastMonthEnd({
      currentBalance: 100,
      remainingPlannedIncome: 0,
      remainingPlannedFixedExpenses: 0,
      variableExpensesSoFar: 300,
      daysElapsed: 10,
      daysRemaining: 20,
    })
    // rythme : 30€/jour × 20 jours = 600€ ; 100 - 600 = -500
    expect(forecast.risqueDecouvert).toBe(true)
    expect(forecast.depassementEstime).toBeCloseTo(500, 2)
  })

  it('intègre les revenus et charges fixes encore attendus', () => {
    const forecast = forecastMonthEnd({
      currentBalance: 200,
      remainingPlannedIncome: 1500, // salaire à venir
      remainingPlannedFixedExpenses: 800, // loyer pas encore prélevé
      variableExpensesSoFar: 0,
      daysElapsed: 5,
      daysRemaining: 26,
    })
    expect(forecast.soldeEstime).toBe(900) // 200 + 1500 - 800 - 0
  })

  it('n’extrapole rien le premier jour du mois, faute d’historique', () => {
    const forecast = forecastMonthEnd({
      currentBalance: 1000,
      remainingPlannedIncome: 0,
      remainingPlannedFixedExpenses: 0,
      variableExpensesSoFar: 0,
      daysElapsed: 0,
      daysRemaining: 31,
    })
    expect(forecast.soldeEstime).toBe(1000)
  })
})

describe('computeCategoryBudgetStatus', () => {
  it('traite l’exemple du cahier des charges (§8)', () => {
    // courses : 600 € prévus
    const status = computeCategoryBudgetStatus('cat-courses', 600, 450)
    expect(status.remaining).toBe(150)
    expect(status.ratio).toBe(0.75)
  })

  it('détecte un dépassement', () => {
    const status = computeCategoryBudgetStatus('cat-loisirs', 200, 250)
    expect(status.remaining).toBe(-50)
    expect(status.ratio).toBe(1.25)
  })

  it('gère un budget non défini (0 €) avec dépenses', () => {
    const status = computeCategoryBudgetStatus('cat-x', 0, 50)
    expect(status.ratio).toBe(Infinity)
  })

  it('gère un budget non défini sans dépense', () => {
    const status = computeCategoryBudgetStatus('cat-x', 0, 0)
    expect(status.ratio).toBe(0)
  })
})
