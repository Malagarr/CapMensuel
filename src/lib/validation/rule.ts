import { z } from 'zod'

/** Validation d'une règle de catégorisation (§10). */
export const ruleSchema = z.object({
  ruleName: z
    .string()
    .trim()
    .min(1, { message: 'Indiquez un nom pour cette règle' })
    .max(80, { message: 'Nom trop long' }),
  matchType: z.enum(['contains', 'equals', 'starts_with', 'ends_with', 'regex'], {
    message: 'Type de correspondance inconnu',
  }),
  matchValue: z
    .string()
    .trim()
    .min(1, { message: 'Indiquez le texte à rechercher dans le libellé' })
    .max(200, { message: 'Valeur trop longue' }),
  categoryId: z.uuid({ message: 'Choisissez une catégorie' }),
  // null = la règle s'applique à tous les comptes du foyer.
  accountId: z
    .string()
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value))
    .refine((value) => value === null || z.uuid().safeParse(value).success, {
      message: 'Compte inconnu',
    }),
  priority: z
    .string()
    .optional()
    .transform((value) => {
      if (value === '' || value === undefined) return 100
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : 100
    })
    .refine((value) => value >= 0 && value <= 1000, {
      message: 'La priorité doit être comprise entre 0 et 1000',
    }),
})

export const ruleIdSchema = z.object({
  ruleId: z.uuid({ message: 'Règle inconnue' }),
})

export type RuleInput = z.infer<typeof ruleSchema>
