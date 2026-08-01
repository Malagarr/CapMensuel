import type { MemberRole } from '@/types/database'

/**
 * Droits au sein d'un foyer (§3).
 *
 * Ces fonctions servent à masquer ou griser l'interface. Elles ne sont PAS la
 * sécurité : celle-ci est appliquée par les politiques Row Level Security de
 * PostgreSQL, qui restent en vigueur même si le client est contourné.
 */

export const roleLabels: Record<MemberRole, string> = {
  admin: 'Administrateur',
  member: 'Membre',
  viewer: 'Lecture seule',
}

export const roleDescriptions: Record<MemberRole, string> = {
  admin:
    'Peut tout faire : saisir des opérations, gérer les comptes, inviter et retirer des membres.',
  member: 'Peut saisir et modifier des opérations, importer des relevés, gérer les budgets.',
  viewer: 'Peut tout consulter, mais ne peut rien modifier.',
}

/** Ordre d'affichage, du plus au moins étendu. */
export const roleOrder: MemberRole[] = ['admin', 'member', 'viewer']

/** Saisir ou modifier des données financières. */
export function canWrite(role: MemberRole | null | undefined): boolean {
  return role === 'admin' || role === 'member'
}

/** Inviter, retirer un membre, changer un rôle, renommer le foyer. */
export function canManageHousehold(role: MemberRole | null | undefined): boolean {
  return role === 'admin'
}
