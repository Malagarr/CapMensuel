import { z } from 'zod'

import { parseAmountInput } from '@/lib/validation/account'

const budgetAmount = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    const value = raw.trim() === '' ? 0 : parseAmountInput(raw)
    if (value === null) {
      ctx.addIssue({ code: 'custom', message: 'Montant invalide. Exemple : 600,00' })
      return z.NEVER
    }
    if (value < 0) {
      ctx.addIssue({ code: 'custom', message: 'Le budget ne peut pas être négatif' })
      return z.NEVER
    }
    return Math.round(value * 100) / 100
  })

export const saveBudgetSchema = z.object({
  categoryId: z.uuid({ message: 'Catégorie inconnue' }),
  year: z.coerce.number().int().min(2000).max(2200),
  month: z.coerce.number().int().min(1).max(12),
  plannedAmount: budgetAmount,
})

export type SaveBudgetInput = z.infer<typeof saveBudgetSchema>
