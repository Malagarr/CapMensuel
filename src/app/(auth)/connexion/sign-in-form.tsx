'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { signInAction } from '@/app/(auth)/actions'
import { Alert } from '@/components/ui/alert'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleFormState } from '@/lib/forms'

export function SignInForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(signInAction, idleFormState)

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {/* Conserve la page demandée avant la redirection vers la connexion. */}
      <input type="hidden" name="suivant" value={nextPath} />

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

      <Field
        label="Mot de passe"
        htmlFor="password"
        required
        error={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      <div className="flex justify-end">
        <Link
          href="/mot-de-passe-oublie"
          className="text-sm font-medium text-primary hover:underline"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      <SubmitButton block size="lg">
        Se connecter
      </SubmitButton>

      <p className="pt-2 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="font-medium text-primary hover:underline">
          Créer un compte
        </Link>
      </p>
    </form>
  )
}
