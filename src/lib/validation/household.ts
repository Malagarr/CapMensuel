import { z } from 'zod'

/** Devises proposées à la création d'un foyer. */
export const SUPPORTED_CURRENCIES = ['EUR', 'CHF', 'CAD', 'USD', 'GBP'] as const

export const currencyLabels: Record<(typeof SUPPORTED_CURRENCIES)[number], string> = {
  EUR: 'Euro (€)',
  CHF: 'Franc suisse (CHF)',
  CAD: 'Dollar canadien ($)',
  USD: 'Dollar américain ($)',
  GBP: 'Livre sterling (£)',
}

export const createHouseholdSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Donnez un nom à votre foyer' })
    .max(80, { message: 'Le nom ne peut pas dépasser 80 caractères' }),
  currency: z.enum(SUPPORTED_CURRENCIES, {
    message: 'Devise non prise en charge',
  }),
})

export const joinHouseholdSchema = z.object({
  // Les codes sont générés en hexadécimal majuscule. On accepte la saisie en
  // minuscules et avec des espaces : personne ne recopie un code au caractère près.
  code: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
    .pipe(
      z
        .string()
        .regex(/^[A-Z0-9]{6,12}$/, { message: 'Ce code d’invitation n’est pas valide' }),
    ),
})

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(255)
    .optional()
    .transform((value) => (value === '' ? undefined : value))
    .refine((value) => value === undefined || z.email().safeParse(value).success, {
      message: 'Adresse e-mail invalide',
    }),
  role: z.enum(['admin', 'member', 'viewer'], { message: 'Rôle inconnu' }),
})

export const changeRoleSchema = z.object({
  memberId: z.uuid({ message: 'Membre inconnu' }),
  role: z.enum(['admin', 'member', 'viewer'], { message: 'Rôle inconnu' }),
})

export const removeMemberSchema = z.object({
  memberId: z.uuid({ message: 'Membre inconnu' }),
})

export const renameHouseholdSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Le nom est obligatoire' })
    .max(80, { message: 'Le nom ne peut pas dépasser 80 caractères' }),
})

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>
export type JoinHouseholdInput = z.infer<typeof joinHouseholdSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
