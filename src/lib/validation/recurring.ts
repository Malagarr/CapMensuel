import { z } from 'zod'

import { parseAmountInput } from '@/lib/validation/account'

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date invalide' })

const positiveAmount = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    const value = parseAmountInput(raw)
    if (value === null) {
      ctx.addIssue({ code: 'custom', message: 'Montant invalide. Exemple : 890,00' })
      return z.NEVER
    }
    if (value <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Le montant doit être supérieur à zéro' })
      return z.NEVER
    }
    return Math.round(value * 100) / 100
  })

export const recurringSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, { message: 'Indiquez un libellé' })
      .max(120, { message: 'Libellé trop long' }),
    direction: z.enum(['expense', 'income'], { message: 'Sens inconnu' }),
    expectedAmount: positiveAmount,
    accountId: z.uuid({ message: 'Choisissez un compte' }),
    categoryId: z
      .string()
      .optional()
      .transform((value) => (value === '' || value === undefined ? null : value))
      .refine((value) => value === null || z.uuid().safeParse(value).success, {
        message: 'Catégorie inconnue',
      }),
    frequency: z.enum(
      ['weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly', 'one_off'],
      { message: 'Fréquence inconnue' },
    ),
    dayOfMonth: z
      .string()
      .optional()
      .transform((value) => {
        if (value === '' || value === undefined) return null
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
      })
      .refine((value) => value === null || (value >= 1 && value <= 31), {
        message: 'Le jour doit être compris entre 1 et 31',
      }),
    nextDate: isoDate,
    endDate: z
      .string()
      .optional()
      .transform((value) => (value === '' || value === undefined ? null : value))
      .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
        message: 'Date de fin invalide',
      }),
    amountIsVariable: z
      .string()
      .optional()
      .transform((value) => value === 'on' || value === 'true'),
    beneficiary: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((value) => (value === '' || value === undefined ? null : value)),
  })
  .refine((data) => data.endDate === null || data.endDate >= data.nextDate, {
    message: 'La date de fin doit être postérieure à la prochaine échéance',
    path: ['endDate'],
  })

export const recurringIdSchema = z.object({
  recurringId: z.uuid({ message: 'Récurrence inconnue' }),
})

export type RecurringInput = z.infer<typeof recurringSchema>
