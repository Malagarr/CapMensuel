'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { requestPasswordResetAction } from '@/app/(auth)/actions'
import { Alert } from '@/components/ui/alert'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleFormState } from '@/lib/forms'

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, idleFormState)

  if (state.status === 'success') {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="E-mail envoyé">
          {state.message}
        </Alert>
        <Link href="/connexion" className="text-sm font-medium text-primary hover:underline">
          Retour à la connexion
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === 'error' && state.message && (
        <Alert tone="danger">{state.message}</Alert>
      )}

      <Field label="Adresse e-mail" htmlFor="email" required error={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          placeholder="vous@exemple.fr"
          invalid={Boolean(state.fieldErrors?.email)}
        />
      </Field>

      <SubmitButton block size="lg">
        Envoyer le lien
      </SubmitButton>

      <p className="pt-2 text-center text-sm text-muted-foreground">
        <Link href="/connexion" className="font-medium text-primary hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </form>
  )
}
