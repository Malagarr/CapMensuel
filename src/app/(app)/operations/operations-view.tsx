'use client'

import { useActionState, useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftRight, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'

import {
  TransactionForm,
  type AccountOption,
  type CategoryOption,
  type EditableTransaction,
  type MemberOption,
} from '@/app/(app)/operations/transaction-form'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { SubmitButton } from '@/components/ui/submit-button'
import { deleteTransactionAction } from '@/lib/actions/transaction'
import { idleFormState } from '@/lib/forms'
import { capitalize, formatDayMonth, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TransactionStatus, TransactionType } from '@/types/database'

export type TransactionRow = {
  id: string
  transactionDate: string
  label: string
  amount: number
  currency: string
  transactionType: TransactionType
  status: TransactionStatus
  // Identifiants conservés pour préremplir le formulaire de modification.
  bankAccountId: string
  categoryId: string | null
  memberUserId: string | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  accountName: string
  memberLabel: string | null
  authorLabel: string | null
  notes: string | null
  isImported: boolean
  transferGroupId: string | null
}

const statusBadges: Partial<
  Record<TransactionStatus, { label: string; tone: 'neutral' | 'warning' | 'info' | 'danger' }>
> = {
  planned: { label: 'Prévue', tone: 'info' },
  pending: { label: 'En attente', tone: 'neutral' },
  to_review: { label: 'À vérifier', tone: 'warning' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
  rejected: { label: 'Rejetée', tone: 'danger' },
}

export function OperationsView({
  transactions,
  accounts,
  categories,
  members,
  canWrite,
  totals,
}: {
  transactions: TransactionRow[]
  accounts: AccountOption[]
  categories: CategoryOption[]
  members: MemberOption[]
  canWrite: boolean
  totals: { income: number; expense: number; currency: string }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Le bouton « Ajouter » de la barre de navigation mobile ouvre directement
  // le formulaire, via ?nouveau=1 (§23). Lazy-init : on ne lit l'URL qu'une
  // fois, à l'ouverture de la page — un revisitage ne doit pas rouvrir le panneau.
  const [panel, setPanel] = useState<'new' | string | null>(() =>
    searchParams.get('nouveau') === '1' ? 'new' : null,
  )
  const [deleteState, deleteAction] = useActionState(deleteTransactionAction, idleFormState)

  const closePanel = useCallback(() => {
    setPanel(null)
    // Nettoie l'URL pour qu'un rechargement ne rouvre pas le panneau.
    if (searchParams.get('nouveau')) router.replace('/operations')
  }, [router, searchParams])

  const editing =
    panel && panel !== 'new' ? transactions.find((t) => t.id === panel) : undefined

  const editable: EditableTransaction | undefined = editing
    ? {
        id: editing.id,
        direction: editing.amount < 0 ? 'expense' : 'income',
        amount: Math.abs(editing.amount),
        transactionDate: editing.transactionDate,
        label: editing.label,
        bankAccountId: editing.bankAccountId,
        categoryId: editing.categoryId,
        memberUserId: editing.memberUserId,
        status: editing.status,
        notes: editing.notes,
      }
    : undefined

  // Regroupement par jour : une liste plate de 200 lignes est illisible.
  const byDay = new Map<string, TransactionRow[]>()
  for (const transaction of transactions) {
    const list = byDay.get(transaction.transactionDate) ?? []
    list.push(transaction)
    byDay.set(transaction.transactionDate, list)
  }

  return (
    <div className="space-y-4">
      {deleteState.status === 'error' && deleteState.message && (
        <Alert tone="danger">{deleteState.message}</Alert>
      )}
      {deleteState.status === 'success' && deleteState.message && (
        <Alert tone="success">{deleteState.message}</Alert>
      )}

      {panel && (
        <Card>
          <CardBody>
            <h2 className="mb-4 text-base font-semibold">
              {editing ? 'Modifier l’opération' : 'Nouvelle opération'}
            </h2>
            <TransactionForm
              key={panel}
              accounts={accounts}
              categories={categories}
              members={members}
              transaction={editable}
              onFinished={closePanel}
            />
          </CardBody>
        </Card>
      )}

      {canWrite && !panel && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button onClick={() => setPanel('new')} size="lg">
            <Plus className="size-4" aria-hidden="true" />
            Ajouter une opération
          </Button>

          <div className="flex gap-4 text-sm">
            <span>
              <span className="text-muted-foreground">Revenus </span>
              <span className="tabular font-semibold text-income">
                {formatMoney(totals.income, totals.currency)}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">Dépenses </span>
              <span className="tabular font-semibold text-expense">
                {formatMoney(totals.expense, totals.currency)}
              </span>
            </span>
          </div>
        </div>
      )}

      {transactions.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center">
            <span
              className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              <Receipt className="size-6" />
            </span>
            <p className="font-medium">Aucune opération</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Ajoutez votre première dépense ou votre premier revenu, ou modifiez les
              filtres si vous en attendiez.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            {[...byDay.entries()].map(([date, rows]) => (
              <section key={date}>
                <h3 className="sticky top-14 z-10 border-b border-border bg-muted/60 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                  {capitalize(formatDayMonth(date))}
                </h3>
                <ul className="divide-y divide-border">
                  {rows.map((transaction) => (
                    <TransactionItem
                      key={transaction.id}
                      transaction={transaction}
                      canWrite={canWrite}
                      onEdit={() => setPanel(transaction.id)}
                      deleteAction={deleteAction}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function TransactionItem({
  transaction,
  canWrite,
  onEdit,
  deleteAction,
}: {
  transaction: TransactionRow
  canWrite: boolean
  onEdit: () => void
  deleteAction: (formData: FormData) => void
}) {
  const isTransfer = transaction.transactionType === 'internal_transfer'
  const badge = statusBadges[transaction.status]

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: transaction.categoryColor ?? '#94A3B8' }}
      >
        {isTransfer ? (
          <ArrowLeftRight className="size-4" aria-hidden="true" />
        ) : (
          <Icon name={transaction.categoryIcon ?? 'circle'} className="size-4" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{transaction.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {transaction.categoryName ?? 'Sans catégorie'} · {transaction.accountName}
          {transaction.memberLabel && ` · ${transaction.memberLabel}`}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
        {transaction.isImported && <Badge tone="neutral">Importée</Badge>}

        <span
          className={cn(
            'tabular whitespace-nowrap font-semibold',
            isTransfer
              ? 'text-muted-foreground'
              : transaction.amount < 0
                ? 'text-expense'
                : 'text-income',
          )}
        >
          {formatMoney(transaction.amount, transaction.currency, { showSign: true })}
        </span>
      </div>

      {canWrite && (
        <div className="flex gap-0.5">
          {/* Un virement se modifie en le supprimant puis en le ressaisissant :
              éditer une seule moitié désynchroniserait les deux comptes. */}
          {!isTransfer && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              aria-label={`Modifier ${transaction.label}`}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </Button>
          )}

          <form action={deleteAction}>
            <input type="hidden" name="transactionId" value={transaction.id} />
            <SubmitButton
              variant="ghost"
              size="sm"
              className="text-danger"
              aria-label={`Supprimer ${transaction.label}`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </SubmitButton>
          </form>
        </div>
      )}
    </li>
  )
}
