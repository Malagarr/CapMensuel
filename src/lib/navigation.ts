import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CalendarClock,
  LayoutDashboard,
  Landmark,
  ListChecks,
  PiggyBank,
  Receipt,
  ShieldCheck,
  Tags,
  Upload,
  Users,
  Wallet,
} from 'lucide-react'

/**
 * Navigation principale (§23).
 *
 * Liste unique partagée par la barre latérale (ordinateur) et la barre du
 * bas (mobile) : les deux doivent toujours pointer vers les mêmes pages,
 * seule leur présentation diffère.
 */
export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Affiché dans la barre du bas (5 places seulement, en comptant « Plus »). */
  mobilePrimary?: boolean
}

export const navItems: NavItem[] = [
  { href: '/tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard, mobilePrimary: true },
  { href: '/operations', label: 'Opérations', icon: Receipt, mobilePrimary: true },
  { href: '/import', label: 'Importer', icon: Upload, mobilePrimary: true },
  { href: '/budgets', label: 'Budgets', icon: PiggyBank, mobilePrimary: true },
  { href: '/comptes', label: 'Comptes', icon: Landmark },
  { href: '/recurrentes', label: 'Récurrentes', icon: CalendarClock },
  { href: '/categories', label: 'Catégories', icon: Tags },
  { href: '/regles', label: 'Règles', icon: ListChecks },
  { href: '/statistiques', label: 'Statistiques', icon: BarChart3 },
  { href: '/foyer', label: 'Foyer', icon: Users },
  { href: '/confidentialite', label: 'Confidentialité', icon: ShieldCheck },
]

/**
 * Sous-ensemble affiché directement dans la barre du bas mobile, dans l'ordre
 * du §23 : Accueil, Opérations, (Ajouter — bouton central géré à part),
 * Importer, Budget.
 */
export const mobilePrimaryItems = navItems.filter((item) => item.mobilePrimary)

/** Le reste, regroupé derrière le bouton « Plus ». */
export const mobileMoreItems = navItems.filter((item) => !item.mobilePrimary)

export const brandIcon = Wallet
