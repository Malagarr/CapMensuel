import type { z } from 'zod'

/**
 * État renvoyé par une Server Action à un formulaire.
 *
 * Conçu pour useActionState (React 19) : le formulaire reste utilisable sans
 * JavaScript, et affiche les erreurs champ par champ quand JavaScript est actif.
 */
export type FormState = {
  status: 'idle' | 'error' | 'success'
  /** Message général, affiché en haut du formulaire. */
  message?: string
  /** Erreurs par nom de champ. */
  fieldErrors?: Record<string, string>
}

export const idleFormState: FormState = { status: 'idle' }

export function errorState(message: string, fieldErrors?: Record<string, string>): FormState {
  return { status: 'error', message, fieldErrors }
}

export function successState(message?: string): FormState {
  return { status: 'success', message }
}

/**
 * Valide des données de formulaire avec un schéma Zod.
 * Renvoie soit les données typées, soit un FormState d'erreur prêt à renvoyer.
 */
export function validateForm<Schema extends z.ZodType>(
  schema: Schema,
  values: unknown,
): { success: true; data: z.infer<Schema> } | { success: false; state: FormState } {
  const parsed = schema.safeParse(values)

  if (parsed.success) {
    return { success: true, data: parsed.data }
  }

  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const field = issue.path.join('.')
    // On garde la première erreur de chaque champ : afficher toute la liste
    // noie l'information utile.
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = issue.message
    }
  }

  return {
    success: false,
    state: errorState('Merci de corriger les champs signalés.', fieldErrors),
  }
}

/** Extrait une chaîne d'un FormData, en tolérant les valeurs absentes. */
export function formString(data: FormData, key: string): string {
  const value = data.get(key)
  return typeof value === 'string' ? value : ''
}
