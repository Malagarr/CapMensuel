'use server'

import { redirect } from 'next/navigation'

import { errorState, formString, successState, validateForm, type FormState } from '@/lib/forms'
import { getSiteUrl } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import {
  passwordResetRequestSchema,
  passwordUpdateSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validation/auth'

/**
 * Traduit les messages d'erreur de Supabase, qui sont en anglais.
 *
 * On reste volontairement vague sur « identifiants incorrects » : préciser que
 * l'adresse existe mais que le mot de passe est faux permettrait d'énumérer les
 * comptes de l'application.
 */
function translateAuthError(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Adresse e-mail ou mot de passe incorrect.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Votre adresse e-mail n’est pas encore confirmée. Consultez votre boîte de réception.'
  }
  if (normalized.includes('user already registered')) {
    return 'Un compte existe déjà avec cette adresse e-mail.'
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Trop de tentatives. Merci de patienter quelques minutes.'
  }
  if (normalized.includes('password should be at least')) {
    return 'Mot de passe trop court.'
  }
  if (normalized.includes('weak password')) {
    return 'Ce mot de passe est trop courant. Choisissez-en un autre.'
  }
  return 'Une erreur est survenue. Merci de réessayer.'
}

/**
 * Empêche une redirection vers un site externe.
 *
 * Sans ce contrôle, un lien « /connexion?suivant=https://site-malveillant » ferait
 * de l'application un tremplin d'hameçonnage (« open redirect »).
 */
function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  return value
}

// ---------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------

export async function signInAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(signInSchema, {
    email: formString(formData, 'email'),
    password: formString(formData, 'password'),
  })

  if (!validation.success) return validation.state

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: validation.data.email,
    password: validation.data.password,
  })

  if (error) {
    return errorState(translateAuthError(error.message))
  }

  // redirect() lève une exception interceptée par Next : rien après ne s'exécute.
  redirect(safeRedirectPath(formString(formData, 'suivant'), '/tableau-de-bord'))
}

// ---------------------------------------------------------------------------
// Inscription
// ---------------------------------------------------------------------------

export async function signUpAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(signUpSchema, {
    firstName: formString(formData, 'firstName'),
    lastName: formString(formData, 'lastName'),
    email: formString(formData, 'email'),
    password: formString(formData, 'password'),
    passwordConfirmation: formString(formData, 'passwordConfirmation'),
  })

  if (!validation.success) return validation.state

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: validation.data.email,
    password: validation.data.password,
    options: {
      // Ces métadonnées alimentent public.users via le déclencheur handle_new_user.
      data: {
        first_name: validation.data.firstName,
        last_name: validation.data.lastName,
      },
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/bienvenue`,
    },
  })

  if (error) {
    return errorState(translateAuthError(error.message))
  }

  // Si la confirmation par e-mail est activée, aucune session n'est ouverte :
  // l'utilisateur doit d'abord cliquer sur le lien reçu.
  if (!data.session) {
    return successState(
      'Compte créé. Un e-mail de confirmation vient de vous être envoyé : ' +
        'cliquez sur le lien qu’il contient pour activer votre compte.',
    )
  }

  redirect('/bienvenue')
}

// ---------------------------------------------------------------------------
// Mot de passe oublié
// ---------------------------------------------------------------------------

export async function requestPasswordResetAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(passwordResetRequestSchema, {
    email: formString(formData, 'email'),
  })

  if (!validation.success) return validation.state

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/reinitialiser-mot-de-passe`,
  })

  // Le message de succès est renvoyé même en cas d'erreur : confirmer qu'une
  // adresse est inconnue permettrait d'énumérer les comptes existants.
  if (error && !error.message.toLowerCase().includes('rate limit')) {
    return successState(
      'Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé.',
    )
  }

  if (error) {
    return errorState(translateAuthError(error.message))
  }

  return successState(
    'Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé.',
  )
}

// ---------------------------------------------------------------------------
// Nouveau mot de passe
// ---------------------------------------------------------------------------

export async function updatePasswordAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateForm(passwordUpdateSchema, {
    password: formString(formData, 'password'),
    passwordConfirmation: formString(formData, 'passwordConfirmation'),
  })

  if (!validation.success) return validation.state

  const supabase = await createClient()

  // La session provient du lien reçu par e-mail : sans elle, n'importe qui
  // pourrait changer le mot de passe d'un compte.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorState(
      'Votre lien de réinitialisation a expiré. Demandez-en un nouveau.',
    )
  }

  const { error } = await supabase.auth.updateUser({
    password: validation.data.password,
  })

  if (error) {
    return errorState(translateAuthError(error.message))
  }

  redirect('/tableau-de-bord')
}

// ---------------------------------------------------------------------------
// Déconnexion
// ---------------------------------------------------------------------------

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/connexion')
}
