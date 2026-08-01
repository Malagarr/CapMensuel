import type { CategoryKind } from '@/types/database'

/**
 * Nature d'une catégorie.
 *
 * Elle détermine dans quel agrégat du tableau de bord ses opérations sont
 * comptées : charges fixes, dépenses variables, exceptionnelles, épargne.
 */
export const categoryKindLabels: Record<CategoryKind, string> = {
  income: 'Revenus',
  fixed_expense: 'Charges fixes',
  variable_expense: 'Dépenses variables',
  exceptional_expense: 'Dépenses exceptionnelles',
  savings: 'Épargne',
  transfer: 'Transferts internes',
}

export const categoryKindDescriptions: Record<CategoryKind, string> = {
  income: 'Tout ce qui entre : salaires, allocations, remboursements.',
  fixed_expense:
    'Montants réguliers et prévisibles : loyer, assurances, abonnements. Ils se déduisent d’office du reste à vivre.',
  variable_expense:
    'Dépenses du quotidien dont le montant change : courses, carburant, loisirs.',
  exceptional_expense:
    'Dépenses ponctuelles et importantes : vacances, travaux, gros achats.',
  savings: 'Ce que vous mettez de côté. Compté comme épargne, pas comme dépense.',
  transfer:
    'Mouvements entre vos propres comptes. Neutres : ni revenu, ni dépense.',
}

/** Ordre d'affichage des sections sur la page Catégories. */
export const categoryKindOrder: CategoryKind[] = [
  'income',
  'fixed_expense',
  'variable_expense',
  'exceptional_expense',
  'savings',
  'transfer',
]

/** Vrai si les opérations de cette nature sortent de l'argent. */
export function isExpenseKind(kind: CategoryKind): boolean {
  return (
    kind === 'fixed_expense' ||
    kind === 'variable_expense' ||
    kind === 'exceptional_expense'
  )
}

/** Icônes proposées lors de la création d'une catégorie. */
export const CATEGORY_ICONS = [
  'house',
  'key-round',
  'landmark',
  'zap',
  'droplet',
  'flame',
  'scale',
  'smartphone',
  'wifi',
  'repeat',
  'shopping-cart',
  'utensils',
  'fuel',
  'train-front',
  'car',
  'baby',
  'heart-pulse',
  'shirt',
  'gamepad-2',
  'paw-print',
  'gift',
  'palmtree',
  'hammer',
  'piggy-bank',
  'briefcase',
  'award',
  'hand-coins',
  'user-round',
  'building-2',
  'undo-2',
  'sparkles',
  'circle-plus',
  'arrow-left-right',
  'target',
  'circle-ellipsis',
  'circle',
] as const

/** Palette des catégories, plus large que celle des comptes. */
export const CATEGORY_COLORS = [
  '#0F9D58',
  '#16A34A',
  '#059669',
  '#0D9488',
  '#0891B2',
  '#0EA5E9',
  '#2563EB',
  '#4F46E5',
  '#7C3AED',
  '#9333EA',
  '#C026D3',
  '#DB2777',
  '#E11D48',
  '#DC2626',
  '#EA580C',
  '#B45309',
  '#CA8A04',
  '#F59E0B',
  '#78716C',
  '#64748B',
] as const
