'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { signUpAction } from '@/app/(auth)/actions'
import { Alert } from '@/components/ui/alert'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleFormState } from '@/lib/forms'

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, idleFormState)

  // Après création du compte, le formulaire est remplacé par la consigne
  // « allez consulter votre boîte mail » : le réafficher n'aurait aucun sens.
  if (state.status === 'success') {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Vérifiez votre boîte de réception">
          {state.message}
        </Alert>
        <p className="text-sm text-muted-foreground">
          L’e-mail n’arrive pas ? Regardez dans les courriers indésirables, puis{' '}
          <Link href="/inscription" className="font-medium text-primary hover:underline">
            réessayez
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === 'error' && state.message && (
        <Alert tone="danger">{state.message}</Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="firstName" required error={state.fieldErrors?.firstName}>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            required
            autoFocus
            invalid={Boolean(state.fieldErrors?.firstName)}
          />
        </Field>

        <Field label="Nom" htmlFor="lastName" required error={state.fieldErrors?.lastName}>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            required
            invalid={Boolean(state.fieldErrors?.lastName)}
          />
        </Field>
      </div>

      <Field label="Adresse e-mail" htmlFor="email" required error={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="vous@exemple.fr"
          invalid={Boolean(state.fieldErrors?.email)}
        />
      </Field>

      <Field
        label="Mot de passe"
        htmlFor="password"
        required
        hint="10 caractères minimum. Une phrase facile à retenir vaut mieux qu’un mot compliqué."
        error={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
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
        Créer mon compte
      </SubmitButton>

      <p className="pt-2 text-center text-sm text-muted-foreground">
        Vous avez déjà un compte ?{' '}
        <Link href="/connexion" className="font-medium text-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  )
}
