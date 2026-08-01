import type { AccountType } from '@/types/database'

/** Libellés des types de compte (§5). */
export const accountTypeLabels: Record<AccountType, string> = {
  checking: 'Compte courant',
  joint: 'Compte joint',
  personal: 'Compte personnel',
  savings: 'Livret d’épargne',
  business: 'Compte professionnel',
  child: 'Compte enfant',
  deferred_card: 'Carte à débit différé',
  other: 'Autre',
}

/** Icône proposée par défaut à la création, selon le type choisi. */
export const accountTypeIcons: Record<AccountType, string> = {
  checking: 'wallet',
  joint: 'users',
  personal: 'user-round',
  savings: 'piggy-bank',
  business: 'briefcase',
  child: 'baby',
  deferred_card: 'credit-card',
  other: 'landmark',
}

/** Précisions affichées sous le sélecteur de type. */
export const accountTypeHints: Partial<Record<AccountType, string>> = {
  savings:
    'Les virements depuis un compte courant vers ce compte seront traités comme de l’épargne, pas comme une dépense.',
  deferred_card:
    'Les paiements sont enregistrés à leur date, mais débités plus tard : le solde théorique en tient compte.',
}

/** Ordre d'affichage dans le sélecteur. */
export const accountTypeOrder: AccountType[] = [
  'checking',
  'joint',
  'personal',
  'savings',
  'deferred_card',
  'child',
  'business',
  'other',
]

/**
 * Couleurs proposées.
 * Choisies pour rester distinguables entre elles et lisibles en mode sombre
 * comme en mode clair.
 */
export const ACCOUNT_COLORS = [
  '#0EA5B7', // turquoise
  '#4F46E5', // indigo
  '#7C3AED', // violet
  '#DB2777', // rose
  '#DC2626', // rouge
  '#EA580C', // orange
  '#CA8A04', // ocre
  '#16A34A', // vert
  '#0891B2', // cyan
  '#475569', // ardoise
] as const

/** Icônes proposées, au-delà de celle du type. */
export const ACCOUNT_ICONS = [
  'wallet',
  'users',
  'user-round',
  'piggy-bank',
  'briefcase',
  'baby',
  'credit-card',
  'landmark',
  'building-2',
] as const
