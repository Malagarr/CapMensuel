'use client'

import { useActionState, useCallback, useState } from 'react'
import {
  CalendarClock,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'

import { RecurringForm } from '@/app/(app)/recurrentes/recurring-form'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  deleteRecurringAction,
  generatePlannedOperationsAction,
  toggleRecurringAction,
} from '@/lib/actions/recurring'
import { idleFormState } from '@/lib/forms'
import { formatDate, formatMoney } from '@/lib/format'
import { describeRecurrence } from '@/lib/recurrence'
import { cn } from '@/lib/utils'
import type { RecurrenceFrequency } from '@/types/database'
import type {
  AccountOption,
  CategoryOption,
} from '@/app/(app)/operations/transaction-form'

export type RecurringRow = {
  id: string
  label: string
  expectedAmount: number
  currency: string
  direction: 'expense' | 'income'
  accountId: string
  accountName: string
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  frequency: RecurrenceFrequency
  dayOfMonth: number | null
  nextDate: string
  endDate: string | null
  amountIsVariable: boolean
  beneficiary: string | null
  isActive: boolean
}

export function RecurringManager({
  recurrings,
  accounts,
  categories,
  canWrite,
}: {
  recurrings: RecurringRow[]
  accounts: AccountOption[]
  categories: CategoryOption[]
  canWrite: boolean
}) {
  const [panel, setPanel] = useState<'new' | string | null>(null)

  const [toggleState, toggleAction] = useActionState(toggleRecurringAction, idleFormState)
  const [deleteState, deleteAction] = useActionState(deleteRecurringAction, idleFormState)
  const [generateState, generateAction] = useActionState(
    generatePlannedOperationsAction,
    idleFormState,
  )

  const closePanel = useCallback(() => setPanel(null), [])

  const editing = panel && panel !== 'new' ? recurrings.find((r) => r.id === panel) : undefined

  const active = recurrings.filter((r) => r.isActive)
  const paused = recurrings.filter((r) => !r.isActive)

  // Total mensuel indicatif : seules les récurrences mensuelles y figurent,
  // additionner un loyer mensuel et une assurance annuelle n'aurait pas de sens.
  const monthlyTotal = active
    .filter((r) => r.frequency === 'monthly')
    .reduce((sum, r) => sum + r.expectedAmount, 0)

  return (
    <div className="space-y-4">
      {[toggleState, deleteState, generateState].map((state, index) =>
        state.status === 'error' && state.message ? (
          <Alert key={index} tone="danger">
            {state.message}
          </Alert>
        ) : state.status === 'success' && state.message ? (
          <Alert key={index} tone="success">
            {state.message}
          </Alert>
        ) : null,
      )}

      {panel && (
        <Card>
          <CardBody>
            <h2 className="mb-4 text-base font-semibold">
              {editing ? `Modifier « ${editing.label} »` : 'Nouvelle opération récurrente'}
            </h2>
            <RecurringForm
              key={panel}
              recurring={editing}
              accounts={accounts}
              categories={categories}
              onFinished={closePanel}
            />
          </CardBody>
        </Card>
      )}

      {canWrite && !panel && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setPanel('new')}>
            <Plus className="size-4" aria-hidden="true" />
            Ajouter une récurrence
          </Button>

          <form action={generateAction}>
            <SubmitButton variant="outline">
              <RefreshCw className="size-4" aria-hidden="true" />
              Préparer les échéances à venir
            </SubmitButton>
          </form>

          {monthlyTotal !== 0 && (
            <span className="ml-auto text-sm">
              <span className="text-muted-foreground">Total mensuel </span>
              <span className="tabular font-semibold">
                {formatMoney(monthlyTotal, recurrings[0]?.currency ?? 'EUR')}
              </span>
            </span>
          )}
        </div>
      )}

      {recurrings.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center">
            <span
              className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              <CalendarClock className="size-6" />
            </span>
            <p className="font-medium">Aucune opération récurrente</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Déclarez ici votre loyer, vos assurances, vos abonnements et votre salaire.
              L’application préparera automatiquement les échéances à venir et les prendra
              en compte dans la prévision de fin de mois.
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <RecurringList
            title="Actives"
            rows={active}
            canWrite={canWrite}
            onEdit={(id) => setPanel(id)}
            toggleAction={toggleAction}
            deleteAction={deleteAction}
          />
          {paused.length > 0 && (
            <RecurringList
              title="Suspendues"
              rows={paused}
              canWrite={canWrite}
              onEdit={(id) => setPanel(id)}
              toggleAction={toggleAction}
              deleteAction={deleteAction}
            />
          )}
        </>
      )}
    </div>
  )
}

function RecurringList({
  title,
  rows,
  canWrite,
  onEdit,
  toggleAction,
  deleteAction,
}: {
  title: string
  rows: RecurringRow[]
  canWrite: boolean
  onEdit: (id: string) => void
  toggleAction: (formData: FormData) => void
  deleteAction: (formData: FormData) => void
}) {
  if (rows.length === 0) return null

  return (
    <Card>
      <CardBody className="p-0">
        <h2 className="border-b border-border px-5 py-2.5 text-sm font-semibold">
          {title} ({rows.length})
        </h2>
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li
              key={row.id}
              className={cn('flex flex-wrap items-center gap-3 px-5 py-3', !row.isActive && 'opacity-70')}
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: row.categoryColor ?? '#94A3B8' }}
              >
                <Icon name={row.categoryIcon ?? 'repeat'} className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{row.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {describeRecurrence(row.frequency, row.dayOfMonth)} ·{' '}
                  {row.categoryName ?? 'Sans catégorie'} · {row.accountName}
                </p>
              </div>

              <div className="flex flex-col items-end">
                <span
                  className={cn(
                    'tabular whitespace-nowrap font-semibold',
                    row.expectedAmount < 0 ? 'text-expense' : 'text-income',
                  )}
                >
                  {formatMoney(row.expectedAmount, row.currency, { showSign: true })}
                </span>
                {row.isActive && (
                  <span className="text-xs text-muted-foreground">
                    prochaine le {formatDate(row.nextDate)}
                  </span>
                )}
              </div>

              {row.amountIsVariable && <Badge tone="neutral">Montant variable</Badge>}

              {canWrite && (
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(row.id)}
                    aria-label={`Modifier ${row.label}`}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </Button>

                  <form action={toggleAction}>
                    <input type="hidden" name="recurringId" value={row.id} />
                    <SubmitButton
                      variant="ghost"
                      size="sm"
                      aria-label={row.isActive ? `Suspendre ${row.label}` : `Réactiver ${row.label}`}
                    >
                      {row.isActive ? (
                        <Pause className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Play className="size-3.5" aria-hidden="true" />
                      )}
                    </SubmitButton>
                  </form>

                  <form action={deleteAction}>
                    <input type="hidden" name="recurringId" value={row.id} />
                    <SubmitButton
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      aria-label={`Supprimer ${row.label}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </SubmitButton>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
