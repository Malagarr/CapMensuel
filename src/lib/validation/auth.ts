import { z } from 'zod'

/**
 * Schémas de validation de l'authentification.
 *
 * Ils sont utilisés à la fois côté navigateur (retour immédiat à la saisie) et
 * côté serveur (source de vérité). Un contrôle uniquement côté client se
 * contourne en une requête HTTP directe : la validation serveur est obligatoire.
 */

const email = z
  .email({ message: 'Adresse e-mail invalide' })
  .trim()
  .toLowerCase()
  .max(255, { message: 'Adresse e-mail trop longue' })

/**
 * Mot de passe : 10 caractères minimum.
 *
 * On privilégie la longueur plutôt qu'une combinaison imposée de symboles :
 * « cheval correct agrafe pile » est plus solide et plus mémorisable que
 * « P@ss1! ». Pensez à aligner ce minimum sur le réglage Supabase
 * (Authentication > Providers > Email > Minimum password length).
 */
const password = z
  .string()
  .min(10, { message: 'Le mot de passe doit contenir au moins 10 caractères' })
  .max(72, { message: 'Le mot de passe ne peut pas dépasser 72 caractères' })

const name = z
  .string()
  .trim()
  .min(1, { message: 'Ce champ est obligatoire' })
  .max(80, { message: 'Ce champ est trop long' })

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { message: 'Mot de passe obligatoire' }),
})

export const signUpSchema = z
  .object({
    firstName: name,
    lastName: name,
    email,
    password,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Les deux mots de passe ne correspondent pas',
    path: ['passwordConfirmation'],
  })

export const passwordResetRequestSchema = z.object({ email })

export const passwordUpdateSchema = z
  .object({
    password,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Les deux mots de passe ne correspondent pas',
    path: ['passwordConfirmation'],
  })

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>
export type PasswordUpdateInput = z.infer<typeof passwordUpdateSchema>
