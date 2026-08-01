'use client'

import { useActionState } from 'react'

import { joinHouseholdAction } from '@/lib/actions/household'
import { Alert } from '@/components/ui/alert'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleFormState } from '@/lib/forms'

export function AcceptInvitationForm({ code }: { code: string }) {
  const [state, formAction] = useActionState(joinHouseholdAction, idleFormState)

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="code" value={code} />

      {state.status === 'error' && state.message && <Alert tone="danger">{state.message}</Alert>}

      <SubmitButton block size="lg">
        Rejoindre ce foyer
      </SubmitButton>
    </form>
  )
}
