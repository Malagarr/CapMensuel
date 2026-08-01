'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'

import {
  copyBudgetsFromPreviousMonthAction,
  deleteBudgetAction,
  saveBudgetAction,
} from '@/lib/actions/budget'
import { Gauge } from '@/components/ui/gauge'
import { Icon } from '@/components/ui/icon'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleFormState } from '@/lib/forms'
import { formatAmount, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

export type BudgetCategoryRow = {
  categoryId: string
  categoryType: string
  name: string
  color: string
  icon: string
  planned: number | null
  spent: number
  currency: string
}

export function BudgetRow({
  category,
  year,
  month,
  canWrite,
}: {
  category: BudgetCategoryRow
  year: number
  month: number
  canWrite: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [saveState, saveAction] = useActionState(saveBudgetAction, idleFormState)
  const [deleteState, deleteAction] = useActionState(deleteBudgetAction, idleFormState)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (saveState.status === 'success') setEditing(false)
  }, [saveState.status])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const hasBudget = category.planned !== null && category.planned > 0

  return (
    <li className="px-5 py-3.5">
      <div className="flex items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: category.color }}
        >
          <Icon name={category.icon} className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{category.name}</p>
          {hasBudget ? (
            <p className="text-xs text-muted-foreground">
              {formatMoney(category.spent, category.currency)} sur{' '}
              {formatMoney(category.planned!, category.currency)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {formatMoney(category.spent, category.currency)} dépensé · aucun budget défini
            </p>
          )}
        </div>

        {canWrite && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-primary hover:underline"
          >
            {hasBudget ? 'Modifier' : 'Définir un budget'}
          </button>
        )}
      </div>

      {hasBudget && !editing && (
        <div className="mt-2.5 pl-12">
          <Gauge label={`Budget ${category.name}`} value={category.spent} max={category.planned!} />
        </div>
      )}

      {editing && canWrite && (
        <form action={saveAction} className="mt-3 flex flex-wrap items-center gap-2 pl-12">
          <input type="hidden" name="categoryId" value={category.categoryId} />
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <label htmlFor={`budget-${category.categoryId}`} className="sr-only">
            Budget mensuel pour {category.name}
          </label>
          <input
            ref={inputRef}
            id={`budget-${category.categoryId}`}
            name="plannedAmount"
            inputMode="decimal"
            defaultValue={category.planned ? formatAmount(category.planned) : ''}
            placeholder="0,00"
            className={cn(
              'tabular h-10 w-32 rounded-lg border border-input bg-card px-3 text-sm focus:border-ring',
              saveState.status === 'error' && 'border-danger',
            )}
          />
          <SubmitButton size="sm">Enregistrer</SubmitButton>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-muted-foreground hover:underline"
          >
            Annuler
          </button>
          {hasBudget && (
            <form action={deleteAction} className="ml-auto">
              <input type="hidden" name="categoryId" value={category.categoryId} />
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="month" value={month} />
              <SubmitButton variant="ghost" size="sm" className="text-danger">
                <Trash2 className="size-3.5" aria-hidden="true" />
                Retirer
              </SubmitButton>
            </form>
          )}
        </form>
      )}

      {saveState.status === 'error' && saveState.message && editing && (
        <p role="alert" className="mt-1.5 pl-12 text-xs text-danger">
          {saveState.message}
        </p>
      )}
      {deleteState.status === 'error' && deleteState.message && (
        <p role="alert" className="mt-1.5 pl-12 text-xs text-danger">
          {deleteState.message}
        </p>
      )}
    </li>
  )
}

export function CopyBudgetsButton({ year, month }: { year: number; month: number }) {
  const [state, formAction] = useActionState(copyBudgetsFromPreviousMonthAction, idleFormState)

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        <SubmitButton variant="outline" size="sm">
          <Copy className="size-3.5" aria-hidden="true" />
          Copier les budgets du mois précédent
        </SubmitButton>
      </form>
      {state.status === 'error' && state.message && (
        <p role="alert" className="text-xs text-danger">
          {state.message}
        </p>
      )}
      {state.status === 'success' && state.message && (
        <p className="text-xs text-success">{state.message}</p>
      )}
    </div>
  )
}
