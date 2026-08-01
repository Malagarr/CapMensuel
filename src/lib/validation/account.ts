import { z } from 'zod'

import { ACCOUNT_COLORS, ACCOUNT_ICONS } from '@/lib/accounts'
import { SUPPORTED_CURRENCIES } from '@/lib/validation/household'

/**
 * Convertit un montant saisi à la française en nombre.
 *
 * Accepte « 1 250,45 », « 1250.45 », « 1 250,45 € », « -89,60 ».
 * Les espaces insécables des séparateurs de milliers sont pris en compte :
 * ce sont eux que produit un copier-coller depuis un relevé bancaire.
 */
export function parseAmountInput(raw: string): number | null {
  const cleaned = raw
    // En JavaScript, \s couvre déjà l'espace insécable (U+00A0) et l'espace
    // fine insécable (U+202F) : ceux qu'un copier-coller de relevé bancaire
    // insère entre les milliers.
    .replace(/\s/g, '')
    .replace(/[€$£]/g, '')
    .replace(',', '.')
    .trim()

  if (cleaned === '' || cleaned === '-' || cleaned === '+') return null

  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/** Champ montant, tolérant sur le format de saisie. */
const amountField = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    // Un champ vide vaut zéro : c'est le cas le plus fréquent à la création.
    if (raw === '') return 0

    const value = parseAmountInput(raw)
    if (value === null) {
      ctx.addIssue({ code: 'custom', message: 'Montant invalide. Exemple : 1 250,45' })
      return z.NEVER
    }
    if (Math.abs(value) > 999_999_999.99) {
      ctx.addIssue({ code: 'custom', message: 'Montant hors limites' })
      return z.NEVER
    }
    return Math.round(value * 100) / 100
  })

export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Donnez un nom à ce compte' })
    .max(60, { message: 'Le nom ne peut pas dépasser 60 caractères' }),
  bankName: z
    .string()
    .trim()
    .max(60, { message: 'Nom d’établissement trop long' })
    .optional()
    .transform((value) => (value === '' ? null : (value ?? null))),
  accountType: z.enum(
    ['checking', 'joint', 'personal', 'savings', 'business', 'child', 'deferred_card', 'other'],
    { message: 'Type de compte inconnu' },
  ),
  initialBalance: amountField,
  currency: z.enum(SUPPORTED_CURRENCIES, { message: 'Devise non prise en charge' }),
  color: z.enum(ACCOUNT_COLORS, { message: 'Couleur non proposée' }),
  icon: z.enum(ACCOUNT_ICONS, { message: 'Icône non proposée' }),
  ownerUserId: z
    .string()
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value))
    .refine((value) => value === null || z.uuid().safeParse(value).success, {
      message: 'Titulaire inconnu',
    }),
  // Une case à cocher non cochée n'est pas envoyée par le navigateur : le
  // champ est alors absent, ce qui doit valoir « false » et non une erreur.
  isShared: z
    .string()
    .optional()
    .transform((value) => value === 'on' || value === 'true'),
})

export const accountIdSchema = z.object({
  accountId: z.uuid({ message: 'Compte inconnu' }),
})

export type AccountInput = z.infer<typeof accountSchema>
