/**
 * Formatage des montants, dates et pourcentages.
 *
 * Toute l'application affiche des valeurs via ces fonctions, jamais via des
 * concaténations manuelles : cela garantit une présentation homogène et évite
 * les erreurs de séparateur décimal (virgule en français, point en anglais).
 */

import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const DEFAULT_LOCALE = 'fr-FR'
const DEFAULT_CURRENCY = 'EUR'

/**
 * Formate un montant en devise.
 * @example formatMoney(1250.4) => "1 250,40 €"
 */
export function formatMoney(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  options: { showSign?: boolean; compact?: boolean } = {},
): string {
  const { showSign = false, compact = false } = options

  const formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? 'compact' : 'standard',
  })

  // Intl place déjà le signe « - ». On n'ajoute manuellement que le « + ».
  const formatted = formatter.format(amount)
  return showSign && amount > 0 ? `+${formatted}` : formatted
}

/**
 * Symbole d'une devise.
 * @example currencySymbol('EUR') => "€" ; currencySymbol('CHF') => "CHF"
 */
export function currencySymbol(currency: string = DEFAULT_CURRENCY): string {
  const parts = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(0)

  return parts.find((part) => part.type === 'currency')?.value ?? currency
}

/**
 * Formate un montant sans symbole de devise (pour les tableaux denses).
 * @example formatAmount(1250.4) => "1 250,40"
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Formate un pourcentage entier.
 * @example formatPercent(0.683) => "68 %"
 */
export function formatPercent(ratio: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio)
}

/** Convertit une valeur (Date ou chaîne ISO) en Date valide, ou null. */
export function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : parseISO(value)
  return isValid(date) ? date : null
}

/**
 * Date courte.
 * @example formatDate('2026-07-12') => "12/07/2026"
 */
export function formatDate(value: Date | string | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, 'dd/MM/yyyy', { locale: fr }) : '—'
}

/**
 * Date longue et lisible.
 * @example formatDateLong('2026-07-12') => "12 juillet 2026"
 */
export function formatDateLong(value: Date | string | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, 'd MMMM yyyy', { locale: fr }) : '—'
}

/**
 * Jour et mois abrégés, pour les listes d'opérations.
 * @example formatDayMonth('2026-07-12') => "12 juil."
 */
export function formatDayMonth(value: Date | string | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, 'd MMM', { locale: fr }) : '—'
}

/**
 * Libellé d'un mois budgétaire.
 * @example formatMonthLabel(2026, 7) => "juillet 2026"
 */
export function formatMonthLabel(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: fr })
}

/**
 * Temps relatif.
 * @example formatRelative(hier) => "il y a 1 jour"
 */
export function formatRelative(value: Date | string | null | undefined): string {
  const date = toDate(value)
  if (!date) return '—'
  return formatDistanceToNowStrict(date, { locale: fr, addSuffix: true })
}

/** Met la première lettre en majuscule (les mois français sont en minuscules). */
export function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1)
}

/** Initiales d'un membre, pour les avatars sans photo. */
export function initials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.trim().charAt(0) ?? ''
  const last = lastName?.trim().charAt(0) ?? ''
  const result = `${first}${last}`.toUpperCase()
  return result.length > 0 ? result : '?'
}
