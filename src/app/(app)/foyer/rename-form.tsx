'use client'

import { useActionState } from 'react'

import { renameHouseholdAction } from '@/lib/actions/household'
import { Alert } from '@/components/ui/alert'
import { Field, Input } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleFormState } from '@/lib/forms'

export function RenameHouseholdForm({
  householdId,
  currentName,
}: {
  householdId: string
  currentName: string
}) {
  const [state, formAction] = useActionState(renameHouseholdAction, idleFormState)

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="householdId" value={householdId} />

      {state.status === 'error' && state.message && <Alert tone="danger">{state.message}</Alert>}
      {state.status === 'success' && state.message && (
        <Alert tone="success">{state.message}</Alert>
      )}

      <Field label="Nom du foyer" htmlFor="household-name" required error={state.fieldErrors?.name}>
        <Input
          id="household-name"
          name="name"
          defaultValue={currentName}
          maxLength={80}
          required
          invalid={Boolean(state.fieldErrors?.name)}
        />
      </Field>

      <SubmitButton variant="outline">Enregistrer</SubmitButton>
    </form>
  )
}
