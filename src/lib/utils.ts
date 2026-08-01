import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Fusionne des classes Tailwind en résolvant les conflits.
 * Exemple : cn('px-2', 'px-4') => 'px-4'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Retire les accents et met en minuscules.
 * Utilisé pour les recherches et la comparaison de libellés bancaires.
 */
export function deburr(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marques diacritiques combinantes
    .toLowerCase()
}

/** Limite une valeur à un intervalle. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Arrondi monétaire au centime.
 * Évite les surprises du binaire flottant : 0.1 + 0.2 = 0.30000000000000004.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Somme une liste de montants en arrondissant au centime. */
export function sumMoney(values: readonly number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0))
}

/** Génère un identifiant court lisible (codes d'invitation, clés de liste). */
export function shortId(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans I, O, 0, 1 : moins d'erreurs de saisie
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}
