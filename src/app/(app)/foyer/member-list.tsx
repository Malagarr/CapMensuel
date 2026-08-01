'use client'

import { useActionState } from 'react'
import { Crown, Trash2, UserRound } from 'lucide-react'

import { changeRoleAction, removeMemberAction } from '@/lib/actions/household'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleFormState } from '@/lib/forms'
import { formatDate, initials } from '@/lib/format'
import { roleLabels, roleOrder } from '@/lib/permissions'
import type { MemberRole } from '@/types/database'

export type MemberRow = {
  memberId: string
  userId: string
  firstName: string | null
  lastName: string | null
  email: string
  role: MemberRole
  joinedAt: string
  isOwner: boolean
}

export function MemberList({
  members,
  currentUserId,
  canManage,
}: {
  members: MemberRow[]
  currentUserId: string
  canManage: boolean
}) {
  const [roleState, roleFormAction] = useActionState(changeRoleAction, idleFormState)
  const [removeState, removeFormAction] = useActionState(removeMemberAction, idleFormState)

  return (
    <div className="space-y-3">
      {roleState.status === 'error' && roleState.message && (
        <Alert tone="danger">{roleState.message}</Alert>
      )}
      {roleState.status === 'success' && roleState.message && (
        <Alert tone="success">{roleState.message}</Alert>
      )}
      {removeState.status === 'error' && removeState.message && (
        <Alert tone="danger">{removeState.message}</Alert>
      )}

      <ul className="divide-y divide-border">
        {members.map((member) => {
          const isSelf = member.userId === currentUserId
          const fullName =
            [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email

          return (
            <li key={member.memberId} className="flex flex-wrap items-center gap-3 py-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
                aria-hidden="true"
              >
                {initials(member.firstName, member.lastName) !== '?' ? (
                  initials(member.firstName, member.lastName)
                ) : (
                  <UserRound className="size-4" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-medium">
                  <span className="truncate">{fullName}</span>
                  {isSelf && <span className="text-xs text-muted-foreground">(vous)</span>}
                  {member.isOwner && (
                    <Badge tone="primary" icon={<Crown className="size-3" aria-hidden="true" />}>
                      Créateur
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.email} · a rejoint le {formatDate(member.joinedAt)}
                </p>
              </div>

              {canManage && !member.isOwner ? (
                <form action={roleFormAction} className="flex items-center gap-2">
                  <input type="hidden" name="memberId" value={member.memberId} />
                  <label htmlFor={`role-${member.memberId}`} className="sr-only">
                    Droits de {fullName}
                  </label>
                  <select
                    id={`role-${member.memberId}`}
                    name="role"
                    defaultValue={member.role}
                    className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
                  >
                    {roleOrder.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                  <SubmitButton variant="outline" size="sm">
                    Appliquer
                  </SubmitButton>
                </form>
              ) : (
                <Badge tone={member.role === 'viewer' ? 'neutral' : 'primary'}>
                  {roleLabels[member.role]}
                </Badge>
              )}

              {/* Le créateur du foyer ne peut pas être retiré : il en est
                  propriétaire et la base refuserait la suppression. */}
              {canManage && !member.isOwner && (
                <form action={removeFormAction}>
                  <input type="hidden" name="memberId" value={member.memberId} />
                  <SubmitButton variant="ghost" size="icon" className="text-danger">
                    <Trash2 className="size-4" aria-hidden="true" />
                    <span className="sr-only">Retirer {fullName} du foyer</span>
                  </SubmitButton>
                </form>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
