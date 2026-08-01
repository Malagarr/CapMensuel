'use client'

import { useActionState, useState } from 'react'

import { deleteMyAccountAction } from '@/lib/actions/profile'
import { Alert } from '@/components/ui/alert'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleFormState } from '@/lib/forms'
import { DELETE_ACCOUNT_CONFIRMATION } from '@/lib/validation/profile'

export function DeleteAccountForm() {
  const [state, formAction] = useActionState(deleteMyAccountAction, idleFormState)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-danger hover:underline"
      >
        Supprimer mon compte
      </button>
    )
  }

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <Alert tone="warning">
        Cette action est <strong>définitive</strong>. Si vous êtes le seul membre d’un
        foyer que vous avez créé, ce foyer et toutes ses données (comptes, opérations,
        budgets) seront supprimés avec votre compte.
      </Alert>

      {state.status === 'error' && state.message && <Alert tone="danger">{state.message}</Alert>}

      <Field
        label={`Tapez « ${DELETE_ACCOUNT_CONFIRMATION} » pour confirmer`}
        htmlFor="delete-confirmation"
        required
        error={state.fieldErrors?.confirmation}
      >
        <Input
          id="delete-confirmation"
          name="confirmation"
          autoComplete="off"
          required
          invalid={Boolean(state.fieldErrors?.confirmation)}
        />
      </Field>

      <div className="flex gap-2">
        <SubmitButton variant="danger">Supprimer définitivement mon compte</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted-foreground hover:underline"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
