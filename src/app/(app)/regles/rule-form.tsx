'use client'

import { useActionState, useEffect } from 'react'

import type {
  RuleAccountOption,
  RuleCategoryOption,
  RuleRow,
} from '@/app/(app)/regles/rules-manager'
import { matchTypeLabels } from '@/app/(app)/regles/rules-manager'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { saveRuleAction } from '@/lib/actions/rule'
import { categoryKindLabels, categoryKindOrder } from '@/lib/categories'
import { idleFormState } from '@/lib/forms'
import type { RuleMatchType } from '@/types/database'

const MATCH_TYPES: RuleMatchType[] = ['contains', 'equals', 'starts_with', 'ends_with', 'regex']

export function RuleForm({
  rule,
  categories,
  accounts,
  onFinished,
}: {
  rule?: RuleRow
  categories: RuleCategoryOption[]
  accounts: RuleAccountOption[]
  onFinished: () => void
}) {
  const [state, formAction] = useActionState(saveRuleAction, idleFormState)

  useEffect(() => {
    if (state.status === 'success') onFinished()
  }, [state.status, onFinished])

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {rule && <input type="hidden" name="ruleId" value={rule.id} />}

      {state.status === 'error' && state.message && <Alert tone="danger">{state.message}</Alert>}

      <Field label="Nom de la règle" htmlFor="rule-name" required error={state.fieldErrors?.ruleName}>
        <Input
          id="rule-name"
          name="ruleName"
          required
          autoFocus
          maxLength={80}
          defaultValue={rule?.ruleName}
          placeholder="Ex. : Salle de sport"
          invalid={Boolean(state.fieldErrors?.ruleName)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Type de correspondance"
          htmlFor="rule-match-type"
          required
          error={state.fieldErrors?.matchType}
        >
          <Select id="rule-match-type" name="matchType" defaultValue={rule?.matchType ?? 'contains'}>
            {MATCH_TYPES.map((type) => (
              <option key={type} value={type}>
                {matchTypeLabels[type]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Valeur recherchée"
          htmlFor="rule-match-value"
          required
          hint="Comparée au libellé nettoyé (sans accents, en minuscules)."
          error={state.fieldErrors?.matchValue}
        >
          <Input
            id="rule-match-value"
            name="matchValue"
            required
            maxLength={200}
            defaultValue={rule?.matchValue}
            placeholder="salle de sport"
            invalid={Boolean(state.fieldErrors?.matchValue)}
          />
        </Field>
      </div>

      <Field
        label="Catégorie à appliquer"
        htmlFor="rule-category"
        required
        error={state.fieldErrors?.categoryId}
      >
        <Select id="rule-category" name="categoryId" defaultValue={rule?.categoryId ?? ''} required>
          <option value="" disabled>
            Choisissez une catégorie
          </option>
          {categoryKindOrder.map((kind) => {
            const options = categories.filter((category) => category.categoryType === kind)
            if (options.length === 0) return null
            return (
              <optgroup key={kind} label={categoryKindLabels[kind]}>
                {options.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parentName ? `${category.parentName} › ${category.name}` : category.name}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Portée"
          htmlFor="rule-account"
          hint="Limitez la règle à un seul compte, ou laissez-la valable pour tout le foyer."
          error={state.fieldErrors?.accountId}
        >
          <Select id="rule-account" name="accountId" defaultValue={rule?.accountId ?? ''}>
            <option value="">Tous les comptes du foyer</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Priorité"
          htmlFor="rule-priority"
          hint="La règle de plus haute priorité l’emporte en cas de conflit."
          error={state.fieldErrors?.priority}
        >
          <Input
            id="rule-priority"
            name="priority"
            type="number"
            min={0}
            max={1000}
            step={1}
            defaultValue={rule?.priority ?? 100}
            invalid={Boolean(state.fieldErrors?.priority)}
          />
        </Field>
      </div>

      <div className="flex gap-2">
        <SubmitButton>{rule ? 'Enregistrer' : 'Créer la règle'}</SubmitButton>
        <Button variant="ghost" onClick={onFinished}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
