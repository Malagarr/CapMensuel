'use client'

import { useActionState } from 'react'

import { updatePasswordAction } from '@/app/(auth)/actions'
import { Alert } from '@/components/ui/alert'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleFormState } from '@/lib/forms'

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, idleFormState)

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === 'error' && state.message && (
        <Alert tone="danger">{state.message}</Alert>
      )}

      <Field
        label="Nouveau mot de passe"
        htmlFor="password"
        required
        hint="10 caractères minimum."
        error={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          minLength={10}
          invalid={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      <Field
        label="Confirmer le mot de passe"
        htmlFor="passwordConfirmation"
        required
        error={state.fieldErrors?.passwordConfirmation}
      >
        <Input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(state.fieldErrors?.passwordConfirmation)}
        />
      </Field>

      <SubmitButton block size="lg">
        Enregistrer le mot de passe
      </SubmitButton>
    </form>
  )
}
