'use client'

import { useActionState, useEffect, useState } from 'react'
import { ArrowLeftRight, Minus, Plus } from 'lucide-react'

import { saveTransactionAction, saveTransferAction } from '@/lib/actions/transaction'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { categoryKindLabels, categoryKindOrder, isExpenseKind } from '@/lib/categories'
import { idleFormState } from '@/lib/forms'
import { cn } from '@/lib/utils'
import type { CategoryKind, TransactionStatus } from '@/types/database'

export type AccountOption = {
  id: string
  name: string
  currency: string
}

export type CategoryOption = {
  id: string
  name: string
  categoryType: CategoryKind
  parentName: string | null
}

export type MemberOption = {
  userId: string
  label: string
}

export type EditableTransaction = {
  id: string
  direction: 'expense' | 'income'
  amount: number
  transactionDate: string
  label: string
  bankAccountId: string
  categoryId: string | null
  memberUserId: string | null
  status: TransactionStatus
  notes: string | null
}

type Mode = 'expense' | 'income' | 'transfer'

const modes: { value: Mode; label: string; icon: typeof Minus }[] = [
  { value: 'expense', label: 'Dépense', icon: Minus },
  { value: 'income', label: 'Revenu', icon: Plus },
  { value: 'transfer', label: 'Virement', icon: ArrowLeftRight },
]

/** Statuts proposés à la saisie. Les états « annulé » et « rejeté » se règlent depuis la liste. */
const statusOptions: { value: TransactionStatus; label: string; hint: string }[] = [
  { value: 'cleared', label: 'Réalisée', hint: 'L’argent a bougé sur le compte.' },
  { value: 'pending', label: 'En attente', hint: 'Payée, pas encore débitée.' },
  { value: 'planned', label: 'Prévue', hint: 'À venir, comptée dans la prévision.' },
  { value: 'to_review', label: 'À vérifier', hint: 'À confirmer plus tard.' },
]

export function TransactionForm({
  accounts,
  categories,
  members,
  transaction,
  onFinished,
}: {
  accounts: AccountOption[]
  categories: CategoryOption[]
  members: MemberOption[]
  /** Opération à modifier ; absent pour une saisie. */
  transaction?: EditableTransaction
  onFinished: () => void
}) {
  const [mode, setMode] = useState<Mode>(transaction?.direction ?? 'expense')

  const [state, formAction] = useActionState(saveTransactionAction, idleFormState)
  const [transferState, transferAction] = useActionState(saveTransferAction, idleFormState)

  useEffect(() => {
    if (state.status === 'success' || transferState.status === 'success') onFinished()
  }, [state.status, transferState.status, onFinished])

  const today = new Date().toISOString().slice(0, 10)

  // Une dépense ne propose que des catégories de dépense, un revenu que des
  // catégories de revenu : proposer l'inverse fausserait tous les agrégats.
  const relevantKinds = categoryKindOrder.filter((kind) =>
    mode === 'income' ? kind === 'income' : isExpenseKind(kind) || kind === 'savings',
  )

  if (mode === 'transfer') {
    return (
      <div>
        {!transaction && <ModeTabs mode={mode} onChange={setMode} />}

        <form action={transferAction} className="space-y-4" noValidate>
          {transferState.status === 'error' && transferState.message && (
            <Alert tone="danger">{transferState.message}</Alert>
          )}

          <Alert tone="info">
            Un virement entre deux de vos comptes n’est ni un revenu ni une dépense. Il
            n’entre pas dans le reste à vivre : seuls les soldes des deux comptes changent.
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Montant"
              htmlFor="transfer-amount"
              required
              error={transferState.fieldErrors?.amount}
            >
              <Input
                id="transfer-amount"
                name="amount"
                inputMode="decimal"
                required
                autoFocus
                placeholder="200,00"
                className="tabular"
                invalid={Boolean(transferState.fieldErrors?.amount)}
              />
            </Field>

            <Field
              label="Date"
              htmlFor="transfer-date"
              required
              error={transferState.fieldErrors?.transactionDate}
            >
              <Input
                id="transfer-date"
                name="transactionDate"
                type="date"
                required
                defaultValue={today}
                invalid={Boolean(transferState.fieldErrors?.transactionDate)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Depuis le compte"
              htmlFor="transfer-from"
              required
              error={transferState.fieldErrors?.fromAccountId}
            >
              <Select id="transfer-from" name="fromAccountId" required>
                <option value="">Choisir…</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Vers le compte"
              htmlFor="transfer-to"
              required
              error={transferState.fieldErrors?.toAccountId}
            >
              <Select id="transfer-to" name="toAccountId" required>
                <option value="">Choisir…</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Libellé"
            htmlFor="transfer-label"
            hint="Facultatif. Par défaut « Virement interne »."
            error={transferState.fieldErrors?.label}
          >
            <Input
              id="transfer-label"
              name="label"
              maxLength={255}
              placeholder="Virement vers le livret"
            />
          </Field>

          <div className="flex gap-2">
            <SubmitButton>Enregistrer le virement</SubmitButton>
            <Button variant="ghost" onClick={onFinished}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div>
      {!transaction && <ModeTabs mode={mode} onChange={setMode} />}

      <form action={formAction} className="space-y-4" noValidate>
        {transaction && <input type="hidden" name="transactionId" value={transaction.id} />}
        <input type="hidden" name="direction" value={mode} />

        {state.status === 'error' && state.message && (
          <Alert tone="danger">{state.message}</Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={mode === 'expense' ? 'Montant dépensé' : 'Montant reçu'}
            htmlFor="transaction-amount"
            required
            hint="Saisissez toujours un montant positif."
            error={state.fieldErrors?.amount}
          >
            <Input
              id="transaction-amount"
              name="amount"
              inputMode="decimal"
              required
              autoFocus
              defaultValue={
                transaction ? transaction.amount.toFixed(2).replace('.', ',') : ''
              }
              placeholder="45,90"
              className="tabular text-lg"
              invalid={Boolean(state.fieldErrors?.amount)}
            />
          </Field>

          <Field
            label="Date"
            htmlFor="transaction-date"
            required
            error={state.fieldErrors?.transactionDate}
          >
            <Input
              id="transaction-date"
              name="transactionDate"
              type="date"
              required
              defaultValue={transaction?.transactionDate ?? today}
              invalid={Boolean(state.fieldErrors?.transactionDate)}
            />
          </Field>
        </div>

        <Field
          label="Libellé"
          htmlFor="transaction-label"
          required
          hint="Ce que vous reconnaîtrez plus tard : « Courses Intermarché », « Salaire mars »."
          error={state.fieldErrors?.label}
        >
          <Input
            id="transaction-label"
            name="label"
            required
            maxLength={255}
            defaultValue={transaction?.label}
            placeholder={mode === 'expense' ? 'Courses' : 'Salaire'}
            invalid={Boolean(state.fieldErrors?.label)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Compte"
            htmlFor="transaction-account"
            required
            error={state.fieldErrors?.bankAccountId}
          >
            <Select
              id="transaction-account"
              name="bankAccountId"
              required
              defaultValue={transaction?.bankAccountId ?? accounts[0]?.id ?? ''}
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
            htmlFor="transaction-category"
            hint="Laissez vide si vous ne savez pas : l’opération sera à vérifier."
            error={state.fieldErrors?.categoryId}
          >
            <Select
              id="transaction-category"
              name="categoryId"
              defaultValue={transaction?.categoryId ?? ''}
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Pour qui"
            htmlFor="transaction-member"
            hint="Facultatif. À qui cette opération se rapporte."
            error={state.fieldErrors?.memberUserId}
          >
            <Select
              id="transaction-member"
              name="memberUserId"
              defaultValue={transaction?.memberUserId ?? ''}
            >
              <option value="">Le foyer</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="État" htmlFor="transaction-status" error={state.fieldErrors?.status}>
            <Select
              id="transaction-status"
              name="status"
              defaultValue={transaction?.status ?? 'cleared'}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} — {option.hint}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Commentaire" htmlFor="transaction-notes" error={state.fieldErrors?.notes}>
          <Textarea
            id="transaction-notes"
            name="notes"
            rows={2}
            maxLength={1000}
            defaultValue={transaction?.notes ?? ''}
            placeholder="Facultatif"
          />
        </Field>

        <div className="flex gap-2">
          <SubmitButton>
            {transaction ? 'Enregistrer' : mode === 'expense' ? 'Ajouter la dépense' : 'Ajouter le revenu'}
          </SubmitButton>
          <Button variant="ghost" onClick={onFinished}>
            Annuler
          </Button>
        </div>
      </form>
    </div>
  )
}

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div role="tablist" aria-label="Type d’opération" className="mb-4 flex gap-1 rounded-xl bg-muted p-1">
      {modes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            mode === value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}
