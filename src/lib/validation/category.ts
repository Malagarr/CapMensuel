import { z } from 'zod'

import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/categories'

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Donnez un nom à cette catégorie' })
    .max(60, { message: 'Le nom ne peut pas dépasser 60 caractères' }),
  categoryType: z.enum(
    ['income', 'fixed_expense', 'variable_expense', 'exceptional_expense', 'savings', 'transfer'],
    { message: 'Nature de catégorie inconnue' },
  ),
  icon: z.enum(CATEGORY_ICONS, { message: 'Icône non proposée' }),
  color: z.enum(CATEGORY_COLORS, { message: 'Couleur non proposée' }),
  // Chaîne vide = catégorie de premier niveau.
  parentCategoryId: z
    .string()
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value))
    .refine((value) => value === null || z.uuid().safeParse(value).success, {
      message: 'Catégorie parente inconnue',
    }),
})

export const categoryIdSchema = z.object({
  categoryId: z.uuid({ message: 'Catégorie inconnue' }),
})

export type CategoryInput = z.infer<typeof categorySchema>
