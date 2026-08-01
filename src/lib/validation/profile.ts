import { z } from 'zod'

/** Phrase que l'utilisateur doit recopier pour confirmer la suppression de son compte. */
export const DELETE_ACCOUNT_CONFIRMATION = 'supprimer'

export const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => value === DELETE_ACCOUNT_CONFIRMATION, {
      message: `Recopiez « ${DELETE_ACCOUNT_CONFIRMATION} » pour confirmer.`,
    }),
})
