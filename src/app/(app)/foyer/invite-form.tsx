'use client'

import { useActionState, useState } from 'react'
import { Check, Clock, Copy, Trash2 } from 'lucide-react'

import { inviteMemberAction, revokeInvitationAction } from '@/lib/actions/household'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleFormState } from '@/lib/forms'
import { formatDate } from '@/lib/format'
import { roleDescriptions, roleLabels, roleOrder } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type { MemberRole } from '@/types/database'

export type InvitationRow = {
  id: string
  code: string
  email: string | null
  role: MemberRole
  expiresAt: string
  /** Une invitation expirée n'est plus utilisable, mais reste à supprimer. */
  isExpired: boolean
}

export function InviteForm({
  householdId,
  invitations,
  joinUrlBase,
}: {
  householdId: string
  invitations: InvitationRow[]
  /** Origine du site, pour construire le lien d'invitation complet. */
  joinUrlBase: string
}) {
  const [state, formAction] = useActionState(inviteMemberAction, idleFormState)
  const [revokeState, revokeFormAction] = useActionState(
    revokeInvitationAction,
    idleFormState,
  )
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(`${joinUrlBase}/rejoindre/${code}`)
      setCopiedCode(code)
      window.setTimeout(() => setCopiedCode(null), 2500)
    } catch {
      // Le presse-papiers peut être refusé (contexte non sécurisé, permission) :
      // le code reste lisible à l'écran, l'utilisateur peut le recopier.
    }
  }

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="householdId" value={householdId} />

        {state.status === 'error' && state.message && (
          <Alert tone="danger">{state.message}</Alert>
        )}
        {state.status === 'success' && state.message && (
          <Alert tone="success">{state.message}</Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Adresse e-mail"
            htmlFor="invite-email"
            hint="Facultatif. Si renseignée, seule cette adresse pourra utiliser le code."
            error={state.fieldErrors?.email}
          >
            <Input
              id="invite-email"
              name="email"
              type="email"
              inputMode="email"
              placeholder="conjoint@exemple.fr"
              invalid={Boolean(state.fieldErrors?.email)}
            />
          </Field>

          <Field label="Droits accordés" htmlFor="invite-role" error={state.fieldErrors?.role}>
            <Select id="invite-role" name="role" defaultValue="member">
              {roleOrder.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <details className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Que peut faire chaque rôle ?
          </summary>
          <dl className="mt-2 space-y-2">
            {roleOrder.map((role) => (
              <div key={role}>
                <dt className="font-medium">{roleLabels[role]}</dt>
                <dd className="text-muted-foreground">{roleDescriptions[role]}</dd>
              </div>
            ))}
          </dl>
        </details>

        <SubmitButton>Générer un code d’invitation</SubmitButton>
      </form>

      {invitations.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">
            Invitations non utilisées ({invitations.length})
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Supprimez celles dont vous n’avez plus besoin : tant qu’un code existe et
            n’a pas expiré, toute personne qui le possède peut rejoindre le foyer.
          </p>

          {revokeState.status === 'error' && revokeState.message && (
            <Alert tone="danger" className="mb-2">
              {revokeState.message}
            </Alert>
          )}
          {revokeState.status === 'success' && revokeState.message && (
            <Alert tone="success" className="mb-2">
              {revokeState.message}
            </Alert>
          )}

          <ul className="divide-y divide-border rounded-xl border border-border">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center gap-3 px-3 py-2.5"
              >
                <code
                  className={cn(
                    'rounded-md bg-muted px-2 py-1 font-mono text-sm tracking-wider',
                    invitation.isExpired && 'text-muted-foreground line-through',
                  )}
                >
                  {invitation.code}
                </code>

                <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                  <span className="block truncate">
                    {invitation.email ?? 'Utilisable par n’importe qui'}
                  </span>
                  <span>
                    {invitation.isExpired ? 'A expiré le ' : 'Expire le '}
                    {formatDate(invitation.expiresAt)}
                  </span>
                </div>

                {invitation.isExpired ? (
                  <Badge
                    tone="warning"
                    icon={<Clock className="size-3" aria-hidden="true" />}
                  >
                    Expirée
                  </Badge>
                ) : (
                  <Badge tone="neutral">{roleLabels[invitation.role]}</Badge>
                )}

                {/* Copier un code expiré n'aurait aucun intérêt. */}
                {!invitation.isExpired && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(invitation.code)}
                    aria-live="polite"
                  >
                    {copiedCode === invitation.code ? (
                      <>
                        <Check className="size-4" aria-hidden="true" />
                        Copié
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" aria-hidden="true" />
                        Copier le lien
                      </>
                    )}
                  </Button>
                )}

                {/* Bouton explicitement libellé : une icône seule ne se voyait pas. */}
                <form action={revokeFormAction}>
                  <input type="hidden" name="invitationId" value={invitation.id} />
                  <SubmitButton
                    variant="outline"
                    size="sm"
                    className="border-danger/40 text-danger hover:bg-danger-soft"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Supprimer
                    <span className="sr-only">l’invitation {invitation.code}</span>
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
