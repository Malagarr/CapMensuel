import { daysInMonth } from '@/lib/recurrence'
import { roundMoney, sumMoney } from '@/lib/utils'
import type { CategoryKind, TransactionStatus } from '@/types/database'

/**
 * Calculs financiers du tableau de bord (§4, §14, §15).
 *
 * Toutes les fonctions sont pures : elles reçoivent des données déjà
 * chargées et ne font aucun accès réseau. C'est la page qui interroge
 * Supabase et leur passe le résultat — ce qui permet de tester ici
 * exhaustivement des cas limites (mois sans opération, jour 1, dernier jour
 * du mois…) sans dépendre d'une base de données.
 *
 * Vocabulaire retenu, faute d'une définition unique et universelle du
 * « reste à vivre » :
 *
 *   - reste à vivre = revenus du mois (réalisés + prévus) moins les charges
 *     fixes du mois (réalisées + prévues). C'est l'enveloppe disponible pour
 *     les dépenses variables, calculée sur le mois entier dès le 1er jour
 *     puisque revenus et charges fixes sont largement prévisibles.
 *   - reste disponible = ce qu'il reste de cette enveloppe une fois les
 *     dépenses variables et exceptionnelles déjà réalisées, et l'épargne déjà
 *     versée, déduites. Ce chiffre diminue au fil du mois.
 *   - reste disponible par jour = reste disponible réparti sur les jours qui
 *     restent avant la fin du mois, jour courant inclus.
 */

export type TransactionForDashboard = {
  amount: number
  transactionDate: string
  status: TransactionStatus
  categoryKind: CategoryKind | null
}

export type MonthlyTotals = {
  year: number
  month: number
  daysInMonth: number
  daysElapsed: number
  daysRemaining: number

  revenusPrevus: number
  revenusRealises: number
  chargesFixesPrevues: number
  chargesFixesRealisees: number
  depensesVariablesRealisees: number
  depensesExceptionnellesRealisees: number
  epargneRealisee: number

  totalDepensesRealisees: number
  resteAVivre: number
  resteDisponible: number
  resteDisponibleParJour: number

  /** Part des revenus déjà dépensée ou épargnée, entre 0 et potentiellement plus de 1. */
  tauxUtilisation: number
}

const EXPENSE_KINDS: CategoryKind[] = ['fixed_expense', 'variable_expense', 'exceptional_expense']

/** Une opération compte-t-elle comme « réalisée » pour ces calculs ? */
function isRealized(status: TransactionStatus): boolean {
  return status === 'cleared' || status === 'pending'
}

/** Une opération compte-t-elle comme « prévue » (réalisée ou à venir) ? */
function isExpectedOrRealized(status: TransactionStatus): boolean {
  return status === 'cleared' || status === 'pending' || status === 'planned'
}

function sumWhere(
  transactions: readonly TransactionForDashboard[],
  predicate: (t: TransactionForDashboard) => boolean,
): number {
  return sumMoney(transactions.filter(predicate).map((t) => Math.abs(t.amount)))
}

/**
 * Nombre de jours écoulés dans le mois, aujourd'hui inclus.
 * Si `today` n'appartient pas au mois demandé (tableau de bord consulté sur
 * un mois passé ou futur), le mois est considéré comme entièrement écoulé.
 */
export function daysElapsedInMonth(year: number, month: number, today: Date): number {
  const total = daysInMonth(year, month)
  if (today.getFullYear() !== year || today.getMonth() + 1 !== month) return total
  return today.getDate()
}

/**
 * Calcule tous les indicateurs du tableau de bord pour un mois donné.
 *
 * @param transactions Opérations du mois, hors virements internes (déjà
 *   filtrés par l'appelant : ils ne sont ni un revenu ni une dépense).
 */
export function computeMonthlyTotals(
  transactions: readonly TransactionForDashboard[],
  year: number,
  month: number,
  today: Date,
): MonthlyTotals {
  const totalDays = daysInMonth(year, month)
  const elapsed = daysElapsedInMonth(year, month, today)
  const remaining = totalDays - elapsed + 1 // le jour courant compte comme restant

  const revenusPrevus = sumWhere(
    transactions,
    (t) => t.categoryKind === 'income' && isExpectedOrRealized(t.status),
  )
  const revenusRealises = sumWhere(
    transactions,
    (t) => t.categoryKind === 'income' && isRealized(t.status),
  )

  const chargesFixesPrevues = sumWhere(
    transactions,
    (t) => t.categoryKind === 'fixed_expense' && isExpectedOrRealized(t.status),
  )
  const chargesFixesRealisees = sumWhere(
    transactions,
    (t) => t.categoryKind === 'fixed_expense' && isRealized(t.status),
  )

  const depensesVariablesRealisees = sumWhere(
    transactions,
    (t) => t.categoryKind === 'variable_expense' && isRealized(t.status),
  )
  const depensesExceptionnellesRealisees = sumWhere(
    transactions,
    (t) => t.categoryKind === 'exceptional_expense' && isRealized(t.status),
  )
  const epargneRealisee = sumWhere(
    transactions,
    (t) => t.categoryKind === 'savings' && isRealized(t.status),
  )

  const totalDepensesRealisees = sumMoney([
    chargesFixesRealisees,
    depensesVariablesRealisees,
    depensesExceptionnellesRealisees,
  ])

  const resteAVivre = roundMoney(revenusPrevus - chargesFixesPrevues)
  const resteDisponible = roundMoney(
    resteAVivre - depensesVariablesRealisees - depensesExceptionnellesRealisees - epargneRealisee,
  )
  const resteDisponibleParJour = remaining > 0 ? roundMoney(resteDisponible / remaining) : resteDisponible

  const tauxUtilisation =
    revenusPrevus > 0
      ? roundMoney((totalDepensesRealisees + epargneRealisee) / revenusPrevus)
      : totalDepensesRealisees > 0
        ? Infinity
        : 0

  return {
    year,
    month,
    daysInMonth: totalDays,
    daysElapsed: elapsed,
    daysRemaining: remaining,
    revenusPrevus,
    revenusRealises,
    chargesFixesPrevues,
    chargesFixesRealisees,
    depensesVariablesRealisees,
    depensesExceptionnellesRealisees,
    epargneRealisee,
    totalDepensesRealisees,
    resteAVivre,
    resteDisponible,
    resteDisponibleParJour,
    tauxUtilisation,
  }
}

export type MonthEndForecast = {
  soldeEstime: number
  /** Vrai si le rythme actuel mène à un solde négatif avant la fin du mois. */
  risqueDecouvert: boolean
  /** Écart entre les dépenses variables au rythme actuel et l'enveloppe restante, si dépassement. */
  depassementEstime: number | null
}

/**
 * Projette le solde de fin de mois (§14).
 *
 * La méthode : au solde actuel de tous les comptes, on ajoute les revenus
 * encore attendus et on retranche les charges fixes encore attendues (l'un
 * comme l'autre prévisibles, via les opérations « prévues » ou les
 * récurrences), puis on extrapole les dépenses variables au rythme observé
 * depuis le début du mois sur les jours qui restent.
 *
 * Toujours présentée comme une estimation : le rythme de dépense peut
 * changer d'un jour à l'autre, en particulier en tout début de mois où peu
 * de jours d'observation faussent l'extrapolation.
 */
export function forecastMonthEnd(input: {
  currentBalance: number
  remainingPlannedIncome: number
  remainingPlannedFixedExpenses: number
  variableExpensesSoFar: number
  daysElapsed: number
  daysRemaining: number
}): MonthEndForecast {
  const {
    currentBalance,
    remainingPlannedIncome,
    remainingPlannedFixedExpenses,
    variableExpensesSoFar,
    daysElapsed,
    daysRemaining,
  } = input

  // Sans historique (1er jour du mois), on ne peut pas extrapoler un rythme :
  // on ne prend en compte que ce qui est déjà connu (revenus et charges fixes).
  const dailyRate = daysElapsed > 0 ? variableExpensesSoFar / daysElapsed : 0
  const projectedVariableExpenses = roundMoney(dailyRate * daysRemaining)

  const soldeEstime = roundMoney(
    currentBalance + remainingPlannedIncome - remainingPlannedFixedExpenses - projectedVariableExpenses,
  )

  return {
    soldeEstime,
    risqueDecouvert: soldeEstime < 0,
    depassementEstime: soldeEstime < 0 ? roundMoney(-soldeEstime) : null,
  }
}

export type CategoryBudgetStatus = {
  categoryId: string
  planned: number
  spent: number
  remaining: number
  ratio: number
}

/** Rapproche les dépenses réelles d'une catégorie de son budget prévu (§14). */
export function computeCategoryBudgetStatus(
  categoryId: string,
  planned: number,
  spent: number,
): CategoryBudgetStatus {
  const remaining = roundMoney(planned - spent)
  const ratio = planned > 0 ? spent / planned : spent > 0 ? Infinity : 0
  return { categoryId, planned, spent, remaining, ratio }
}

/** Filtre les types de catégorie qui comptent comme une dépense. */
export function isExpenseCategoryKind(kind: CategoryKind): boolean {
  return EXPENSE_KINDS.includes(kind)
}
