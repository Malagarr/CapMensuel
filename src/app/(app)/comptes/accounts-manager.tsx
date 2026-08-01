'use client'

import { useActionState, useCallback, useState } from 'react'
import { Archive, ArchiveRestore, Pencil, Plus, Trash2, Wallet } from 'lucide-react'

import { AccountForm } from '@/app/(app)/comptes/account-form'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { SubmitButton } from '@/components/ui/submit-button'
import { deleteAccountAction, toggleAccountArchiveAction } from '@/lib/actions/account'
import { accountTypeLabels } from '@/lib/accounts'
import { idleFormState } from '@/lib/forms'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AccountType } from '@/types/database'

export type AccountRow = {
  id: string
  name: string
  bankName: string | null
  accountType: AccountType
  initialBalance: number
  currency: string
  color: string
  icon: string
  ownerUserId: string | null
  isShared: boolean
  isActive: boolean
  /** Solde des opérations réellement passées en banque. */
  currentBalance: number
  /** Solde incluant les opérations en attente et prévues. */
  projectedBalance: number
  transactionCount: number
}

export type MemberOption = {
  userId: string
  label: string
}

export function AccountsManager({
  accounts,
  members,
  householdCurrency,
  canWrite,
}: {
  accounts: AccountRow[]
  members: MemberOption[]
  householdCurrency: string
  canWrite: boolean
}) {
  /** null = aucun panneau ouvert ; 'new' = création ; sinon identifiant du compte. */
  const [editing, setEditing] = useState<string | null>(null)

  const [archiveState, archiveAction] = useActionState(
    toggleAccountArchiveAction,
    idleFormState,
  )
  const [deleteState, deleteAction] = useActionState(deleteAccountAction, idleFormState)

  const closePanel = useCallback(() => setEditing(null), [])

  const activeAccounts = accounts.filter((account) => account.isActive)
  const archivedAccounts = accounts.filter((account) => !account.isActive)

  const editingAccount =
    editing && editing !== 'new' ? accounts.find((a) => a.id === editing) : undefined

  return (
    <div className="space-y-4">
      {archiveState.status === 'error' && archiveState.message && (
        <Alert tone="danger">{archiveState.message}</Alert>
      )}
      {archiveState.status === 'success' && archiveState.message && (
        <Alert tone="success">{archiveState.message}</Alert>
      )}
      {deleteState.status === 'error' && deleteState.message && (
        <Alert tone="danger" title="Suppression impossible">
          {deleteState.message}
        </Alert>
      )}
      {deleteState.status === 'success' && deleteState.message && (
        <Alert tone="success">{deleteState.message}</Alert>
      )}

      {/* Panneau de création ou de modification */}
      {editing && (
        <Card>
          <CardBody>
            <h2 className="mb-4 text-base font-semibold">
              {editingAccount ? `Modifier « ${editingAccount.name} »` : 'Nouveau compte'}
            </h2>
            <AccountForm
              // La clé force la réinitialisation du formulaire quand on passe
              // d'un compte à un autre sans refermer le panneau.
              key={editing}
              account={editingAccount}
              members={members}
              householdCurrency={householdCurrency}
              onFinished={closePanel}
            />
          </CardBody>
        </Card>
      )}

      {canWrite && !editing && (
        <Button onClick={() => setEditing('new')}>
          <Plus className="size-4" aria-hidden="true" />
          Ajouter un compte
        </Button>
      )}

      {accounts.length === 0 && !editing ? (
        <Card>
          <CardBody className="py-10 text-center">
            <span
              className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              <Wallet className="size-6" />
            </span>
            <p className="font-medium">Aucun compte pour l’instant</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Commencez par votre compte courant principal. Vous pourrez ensuite ajouter
              un compte joint, un livret d’épargne ou une carte à débit différé.
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {activeAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                members={members}
                canWrite={canWrite}
                onEdit={() => setEditing(account.id)}
                archiveAction={archiveAction}
                deleteAction={deleteAction}
              />
            ))}
          </ul>

          {archivedAccounts.length > 0 && (
            <details className="rounded-app border border-border">
              <summary className="cursor-pointer px-5 py-3 text-sm font-medium">
                Comptes archivés ({archivedAccounts.length})
              </summary>
              <ul className="grid gap-3 p-5 pt-0 sm:grid-cols-2">
                {archivedAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    members={members}
                    canWrite={canWrite}
                    onEdit={() => setEditing(account.id)}
                    archiveAction={archiveAction}
                    deleteAction={deleteAction}
                  />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  )
}

function AccountCard({
  account,
  members,
  canWrite,
  onEdit,
  archiveAction,
  deleteAction,
}: {
  account: AccountRow
  members: MemberOption[]
  canWrite: boolean
  onEdit: () => void
  archiveAction: (formData: FormData) => void
  deleteAction: (formData: FormData) => void
}) {
  const owner = members.find((member) => member.userId === account.ownerUserId)

  // Le solde théorique n'est affiché que s'il diffère : sinon c'est du bruit.
  const hasPending =
    Math.abs(account.projectedBalance - account.currentBalance) >= 0.005

  return (
    <li>
      <Card className={cn('h-full', !account.isActive && 'opacity-70')}>
        <CardBody className="flex h-full flex-col gap-3">
          <div className="flex items-start gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: account.color }}
            >
              <Icon name={account.icon} className="size-5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{account.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {accountTypeLabels[account.accountType]}
                {account.bankName && ` · ${account.bankName}`}
              </p>
            </div>
          </div>

          <div>
            <p
              className={cn(
                'tabular text-xl font-bold',
                account.currentBalance < 0 && 'text-danger',
              )}
            >
              {formatMoney(account.currentBalance, account.currency)}
            </p>
            {hasPending && (
              <p className="tabular text-xs text-muted-foreground">
                {formatMoney(account.projectedBalance, account.currency)} après opérations
                prévues
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {!account.isActive && (
              <Badge tone="neutral" icon={<Archive className="size-3" aria-hidden="true" />}>
                Archivé
              </Badge>
            )}
            <Badge tone={account.isShared ? 'primary' : 'neutral'}>
              {account.isShared ? 'Partagé' : 'Personnel'}
            </Badge>
            {owner && <Badge tone="neutral">{owner.label}</Badge>}
          </div>

          {canWrite && (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="size-3.5" aria-hidden="true" />
                Modifier
              </Button>

              <form action={archiveAction}>
                <input type="hidden" name="accountId" value={account.id} />
                <SubmitButton variant="ghost" size="sm">
                  {account.isActive ? (
                    <>
                      <Archive className="size-3.5" aria-hidden="true" />
                      Archiver
                    </>
                  ) : (
                    <>
                      <ArchiveRestore className="size-3.5" aria-hidden="true" />
                      Réactiver
                    </>
                  )}
                </SubmitButton>
              </form>

              {/* La suppression n'est proposée que sur un compte vierge :
                  ailleurs elle échouerait, l'historique devant être préservé. */}
              {account.transactionCount === 0 && (
                <form action={deleteAction}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <SubmitButton variant="ghost" size="sm" className="text-danger">
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Supprimer
                  </SubmitButton>
                </form>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </li>
  )
}
