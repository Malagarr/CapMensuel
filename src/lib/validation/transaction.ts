import { z } from 'zod'

import { parseAmountInput } from '@/lib/validation/account'

/** Date au format ISO court, telle qu'envoyée par <input type="date">. */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date invalide' })
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'Date invalide',
  })
  .refine(
    (value) => {
      const year = Number(value.slice(0, 4))
      return year >= 2000 && year <= 2100
    },
    { message: 'La date doit se situer entre 2000 et 2100' },
  )

/**
 * Montant strictement positif saisi par l'utilisateur.
 *
 * Le signe n'est jamais saisi : il découle du sens choisi (dépense ou revenu).
 * Demander « -45 » pour une dépense serait une source d'erreurs constante.
 */
const positiveAmount = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    const value = parseAmountInput(raw)

    if (value === null) {
      ctx.addIssue({ code: 'custom', message: 'Montant invalide. Exemple : 45,90' })
      return z.NEVER
    }
    if (value <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Le montant doit être supérieur à zéro' })
      return z.NEVER
    }
    if (value > 999_999_999.99) {
      ctx.addIssue({ code: 'custom', message: 'Montant hors limites' })
      return z.NEVER
    }
    return Math.round(value * 100) / 100
  })

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `Ce champ ne peut pas dépasser ${max} caractères` })
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value))

const optionalUuid = z
  .string()
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value))
  .refine((value) => value === null || z.uuid().safeParse(value).success, {
    message: 'Valeur inconnue',
  })

/** Saisie d'un revenu ou d'une dépense. */
export const transactionSchema = z.object({
  direction: z.enum(['expense', 'income'], { message: 'Sens de l’opération inconnu' }),
  amount: positiveAmount,
  transactionDate: isoDate,
  label: z
    .string()
    .trim()
    .min(1, { message: 'Indiquez un libellé' })
    .max(255, { message: 'Libellé trop long' }),
  bankAccountId: z.uuid({ message: 'Choisissez un compte' }),
  categoryId: optionalUuid,
  memberUserId: optionalUuid,
  status: z.enum(['planned', 'pending', 'cleared', 'to_review'], {
    message: 'Statut inconnu',
  }),
  paymentMethod: z
    .enum(['card', 'deferred_card', 'direct_debit', 'transfer', 'check', 'cash', 'fee', 'other'])
    .optional()
    .or(z.literal('').transform(() => undefined)),
  notes: optionalText(1000),
})

/** Saisie d'un virement interne entre deux comptes du foyer (§12). */
export const transferSchema = z
  .object({
    amount: positiveAmount,
    transactionDate: isoDate,
    label: z
      .string()
      .trim()
      .max(255, { message: 'Libellé trop long' })
      .optional()
      .transform((value) => (value === '' || value === undefined ? 'Virement interne' : value)),
    fromAccountId: z.uuid({ message: 'Choisissez le compte de départ' }),
    toAccountId: z.uuid({ message: 'Choisissez le compte d’arrivée' }),
    notes: optionalText(1000),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: 'Les deux comptes doivent être différents',
    path: ['toAccountId'],
  })

export const transactionIdSchema = z.object({
  transactionId: z.uuid({ message: 'Opération inconnue' }),
})

export type TransactionInput = z.infer<typeof transactionSchema>
export type TransferInput = z.infer<typeof transferSchema>
