'use client'

import { useActionState, useEffect, useState } from 'react'

import { saveRecurringAction } from '@/lib/actions/recurring'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { categoryKindLabels, categoryKindOrder, isExpenseKind } from '@/lib/categories'
import { idleFormState } from '@/lib/forms'
import { frequencyLabels, frequencyOrder } from '@/lib/recurrence'
import type { RecurrenceFrequency } from '@/types/database'
import type {
  AccountOption,
  CategoryOption,
} from '@/app/(app)/operations/transaction-form'
import type { RecurringRow } from '@/app/(app)/recurrentes/recurring-manager'

/** Fréquences pour lesquelles un jour du mois a un sens. */
const MONTHLY_LIKE: RecurrenceFrequency[] = [
  'monthly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'yearly',
]

export function RecurringForm({
  recurring,
  accounts,
  categories,
  onFinished,
}: {
  recurring?: RecurringRow
  accounts: AccountOption[]
  categories: CategoryOption[]
  onFinished: () => void
}) {
  const [state, formAction] = useActionState(saveRecurringAction, idleFormState)

  const [direction, setDirection] = useState<'expense' | 'income'>(
    recurring?.direction ?? 'expense',
  )
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(
    recurring?.frequency ?? 'monthly',
  )

  useEffect(() => {
    if (state.status === 'success') onFinished()
  }, [state.status, onFinished])

  const today = new Date().toISOString().slice(0, 10)
  const showDayOfMonth = MONTHLY_LIKE.includes(frequency)

  const relevantKinds = categoryKindOrder.filter((kind) =>
    direction === 'income' ? kind === 'income' : isExpenseKind(kind) || kind === 'savings',
  )

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {recurring && <input type="hidden" name="recurringId" value={recurring.id} />}

      {state.status === 'error' && state.message && (
        <Alert tone="danger">{state.message}</Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Libellé"
          htmlFor="recurring-label"
          required
          hint="Par exemple « Loyer », « Assurance auto », « Salaire »."
          error={state.fieldErrors?.label}
        >
          <Input
            id="recurring-label"
            name="label"
            required
            autoFocus
            maxLength={120}
            defaultValue={recurring?.label}
            placeholder="Loyer"
            invalid={Boolean(state.fieldErrors?.label)}
          />
        </Field>

        <Field label="Sens" htmlFor="recurring-direction" required>
          <Select
            id="recurring-direction"
            name="direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value as 'expense' | 'income')}
          >
            <option value="expense">Dépense</option>
            <option value="income">Revenu</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Montant prévu"
          htmlFor="recurring-amount"
          required
          hint="Toujours positif : le sens est choisi ci-dessus."
          error={state.fieldErrors?.expectedAmount}
        >
          <Input
            id="recurring-amount"
            name="expectedAmount"
            inputMode="decimal"
            required
            defaultValue={
              recurring ? Math.abs(recurring.expectedAmount).toFixed(2).replace('.', ',') : ''
            }
            placeholder="890,00"
            className="tabular"
            invalid={Boolean(state.fieldErrors?.expectedAmount)}
          />
        </Field>

        <Field label="Fréquence" htmlFor="recurring-frequency" required>
          <Select
            id="recurring-frequency"
            name="frequency"
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as RecurrenceFrequency)}
          >
            {frequencyOrder.map((value) => (
              <option key={value} value={value}>
                {frequencyLabels[value]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Prochaine échéance"
          htmlFor="recurring-next"
          required
          error={state.fieldErrors?.nextDate}
        >
          <Input
            id="recurring-next"
            name="nextDate"
            type="date"
            required
            defaultValue={recurring?.nextDate ?? today}
            invalid={Boolean(state.fieldErrors?.nextDate)}
          />
        </Field>

        {showDayOfMonth ? (
          <Field
            label="Jour habituel du mois"
            htmlFor="recurring-day"
            hint="Si le mois est trop court, l’échéance tombe le dernier jour."
            error={state.fieldErrors?.dayOfMonth}
          >
            <Input
              id="recurring-day"
              name="dayOfMonth"
              type="number"
              min={1}
              max={31}
              defaultValue={recurring?.dayOfMonth ?? ''}
              placeholder="5"
              invalid={Boolean(state.fieldErrors?.dayOfMonth)}
            />
          </Field>
        ) : (
          <Field
            label="Fin (facultatif)"
            htmlFor="recurring-end"
            hint="Laissez vide pour une récurrence sans fin."
            error={state.fieldErrors?.endDate}
          >
            <Input
              id="recurring-end"
              name="endDate"
              type="date"
              defaultValue={recurring?.endDate ?? ''}
              invalid={Boolean(state.fieldErrors?.endDate)}
            />
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Compte"
          htmlFor="recurring-account"
          required
          error={state.fieldErrors?.accountId}
        >
          <Select
            id="recurring-account"
            name="accountId"
            required
            defaultValue={recurring?.accountId ?? accounts[0]?.id ?? ''}
          >
            <option value="">Choisir…</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Catégorie"
          htmlFor="recurring-category"
          error={state.fieldErrors?.categoryId}
        >
          <Select
            id="recurring-category"
            name="categoryId"
            defaultValue={recurring?.categoryId ?? ''}
          >
            <option value="">Sans catégorie</option>
            {relevantKinds.map((kind) => {
              const options = categories.filter((c) => c.categoryType === kind)
              if (options.length === 0) return null
              return (
                <optgroup key={kind} label={categoryKindLabels[kind]}>
                  {options.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.parentName
                        ? `${category.parentName} › ${category.name}`
                        : category.name}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </Select>
        </Field>
      </div>

      {showDayOfMonth && (
        <Field
          label="Fin (facultatif)"
          htmlFor="recurring-end-monthly"
          hint="Laissez vide pour une récurrence sans fin. Utile pour un crédit à échéances comptées."
          error={state.fieldErrors?.endDate}
        >
          <Input
            id="recurring-end-monthly"
            name="endDate"
            type="date"
            defaultValue={recurring?.endDate ?? ''}
            invalid={Boolean(state.fieldErrors?.endDate)}
          />
        </Field>
      )}

      <label className="flex items-start gap-2.5 rounded-xl border border-border p-3">
        <input
          type="checkbox"
          name="amountIsVariable"
          defaultChecked={recurring?.amountIsVariable ?? false}
          className="mt-0.5 size-4 rounded border-input"
        />
        <span className="text-sm">
          <span className="font-medium">Le montant varie d’une fois à l’autre</span>
          <span className="mt-0.5 block text-muted-foreground">
            À cocher pour l’électricité, le gaz ou le carburant. Le montant saisi sert
            alors d’estimation pour la prévision, et l’écart avec le prélèvement réel ne
            sera pas signalé comme une anomalie.
          </span>
        </span>
      </label>

      <div className="flex gap-2">
        <SubmitButton>{recurring ? 'Enregistrer' : 'Créer la récurrence'}</SubmitButton>
        <Button variant="ghost" onClick={onFinished}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
