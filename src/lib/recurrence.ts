import type { RecurrenceFrequency } from '@/types/database'

/**
 * Calcul des échéances récurrentes (§13).
 *
 * Toutes les dates sont manipulées en UTC et au format « AAAA-MM-JJ ». Passer
 * par l'heure locale introduirait des décalages d'un jour selon le fuseau et
 * l'heure d'été, ce qui ferait glisser les échéances.
 */

export const frequencyLabels: Record<RecurrenceFrequency, string> = {
  weekly: 'Chaque semaine',
  biweekly: 'Toutes les deux semaines',
  monthly: 'Chaque mois',
  bimonthly: 'Tous les deux mois',
  quarterly: 'Chaque trimestre',
  semiannual: 'Tous les six mois',
  yearly: 'Chaque année',
  one_off: 'Une seule fois',
}

export const frequencyOrder: RecurrenceFrequency[] = [
  'monthly',
  'weekly',
  'biweekly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'yearly',
  'one_off',
]

/** Nombre de mois ajoutés à chaque échéance, pour les fréquences mensuelles. */
const MONTH_STEPS: Partial<Record<RecurrenceFrequency, number>> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
}

/** Nombre de jours ajoutés, pour les fréquences hebdomadaires. */
const DAY_STEPS: Partial<Record<RecurrenceFrequency, number>> = {
  weekly: 7,
  biweekly: 14,
}

function toParts(isoDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate.split('-').map(Number)
  return { year: year!, month: month!, day: day! }
}

function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Nombre de jours dans un mois donné. */
export function daysInMonth(year: number, month: number): number {
  // Le jour 0 du mois suivant est le dernier jour du mois demandé.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Échéance suivante d'une récurrence.
 *
 * @param current  Date de l'échéance courante, au format AAAA-MM-JJ.
 * @param frequency Périodicité.
 * @param dayOfMonth Jour habituel du mois (1-31). Si le mois est trop court,
 *   l'échéance tombe le dernier jour : un prélèvement prévu le 31 a lieu le 28
 *   ou le 29 en février, comme le ferait la banque.
 * @returns La date suivante, ou null si la récurrence ne se répète pas.
 */
export function nextOccurrence(
  current: string,
  frequency: RecurrenceFrequency,
  dayOfMonth?: number | null,
): string | null {
  if (frequency === 'one_off') return null

  const { year, month, day } = toParts(current)

  const dayStep = DAY_STEPS[frequency]
  if (dayStep) {
    const date = new Date(Date.UTC(year, month - 1, day))
    date.setUTCDate(date.getUTCDate() + dayStep)
    return date.toISOString().slice(0, 10)
  }

  const monthStep = MONTH_STEPS[frequency]
  if (!monthStep) return null

  // Report du mois avec passage d'année.
  const totalMonths = month - 1 + monthStep
  const nextYear = year + Math.floor(totalMonths / 12)
  const nextMonth = (totalMonths % 12) + 1

  // Le jour cible est celui demandé par l'utilisateur, sinon celui de la
  // date courante — mais jamais au-delà du dernier jour du mois visé.
  const target = dayOfMonth ?? day
  const lastDay = daysInMonth(nextYear, nextMonth)

  return toIso(nextYear, nextMonth, Math.min(target, lastDay))
}

/**
 * Toutes les échéances d'une récurrence jusqu'à une date limite incluse.
 *
 * Sert à préparer les opérations prévues du mois à venir. La liste est bornée
 * pour éviter qu'une récurrence hebdomadaire mal configurée ne génère des
 * milliers de lignes.
 */
export function occurrencesUntil(
  start: string,
  until: string,
  frequency: RecurrenceFrequency,
  options: { dayOfMonth?: number | null; end?: string | null; limit?: number } = {},
): string[] {
  const { dayOfMonth, end, limit = 60 } = options
  const dates: string[] = []

  let cursor: string | null = start

  while (cursor && cursor <= until && dates.length < limit) {
    if (end && cursor > end) break
    dates.push(cursor)
    cursor = nextOccurrence(cursor, frequency, dayOfMonth)
  }

  return dates
}

/** Décrit une récurrence en une phrase, pour l'interface. */
export function describeRecurrence(
  frequency: RecurrenceFrequency,
  dayOfMonth?: number | null,
): string {
  if (frequency === 'one_off') return 'Une seule fois'

  const base = frequencyLabels[frequency]
  if (dayOfMonth && MONTH_STEPS[frequency]) {
    return `${base}, le ${dayOfMonth}`
  }
  return base
}
