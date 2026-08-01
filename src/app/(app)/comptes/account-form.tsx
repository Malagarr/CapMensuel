'use client'

import { useActionState, useEffect, useState } from 'react'
import { Check } from 'lucide-react'

import { saveAccountAction } from '@/lib/actions/account'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  ACCOUNT_COLORS,
  ACCOUNT_ICONS,
  accountTypeHints,
  accountTypeIcons,
  accountTypeLabels,
  accountTypeOrder,
} from '@/lib/accounts'
import { idleFormState } from '@/lib/forms'
import { formatAmount } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SUPPORTED_CURRENCIES, currencyLabels } from '@/lib/validation/household'
import type { AccountType } from '@/types/database'
import type { AccountRow, MemberOption } from '@/app/(app)/comptes/accounts-manager'

export function AccountForm({
  account,
  members,
  householdCurrency,
  onFinished,
}: {
  /** Compte à modifier, ou undefined pour une création. */
  account?: AccountRow
  members: MemberOption[]
  householdCurrency: string
  onFinished: () => void
}) {
  const [state, formAction] = useActionState(saveAccountAction, idleFormState)

  const [accountType, setAccountType] = useState<AccountType>(
    account?.accountType ?? 'checking',
  )
  const [color, setColor] = useState<string>(account?.color ?? ACCOUNT_COLORS[0])
  const [icon, setIcon] = useState<string>(
    account?.icon ?? accountTypeIcons.checking,
  )

  // À la création, changer le type propose l'icône correspondante. En
  // modification on n'y touche pas : l'utilisateur a pu la choisir exprès.
  function handleTypeChange(next: AccountType) {
    setAccountType(next)
    if (!account) setIcon(accountTypeIcons[next])
  }

  // Referme le panneau une fois l'enregistrement réussi. Passer par un effet
  // est indispensable : appeler onFinished() pendant le rendu modifierait
  // l'état du parent au milieu du rendu de l'enfant, ce que React interdit.
  useEffect(() => {
    if (state.status === 'success') onFinished()
  }, [state.status, onFinished])

  const hint = accountTypeHints[accountType]

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {account && <input type="hidden" name="accountId" value={account.id} />}
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="icon" value={icon} />

      {state.status === 'error' && state.message && (
        <Alert tone="danger">{state.message}</Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nom du compte"
          htmlFor="account-name"
          required
          hint="Par exemple « Compte courant Marie » ou « Livret A »."
          error={state.fieldErrors?.name}
        >
          <Input
            id="account-name"
            name="name"
            required
            autoFocus
            maxLength={60}
            defaultValue={account?.name}
            placeholder="Compte courant"
            invalid={Boolean(state.fieldErrors?.name)}
          />
        </Field>

        <Field
          label="Établissement bancaire"
          htmlFor="account-bank"
          hint="Facultatif."
          error={state.fieldErrors?.bankName}
        >
          <Input
            id="account-bank"
            name="bankName"
            maxLength={60}
            defaultValue={account?.bankName ?? ''}
            placeholder="Crédit Agricole"
            invalid={Boolean(state.fieldErrors?.bankName)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Type de compte"
          htmlFor="account-type"
          required
          hint={hint}
          error={state.fieldErrors?.accountType}
        >
          <Select
            id="account-type"
            name="accountType"
            value={accountType}
            onChange={(event) => handleTypeChange(event.target.value as AccountType)}
          >
            {accountTypeOrder.map((type) => (
              <option key={type} value={type}>
                {accountTypeLabels[type]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Solde initial"
          htmlFor="account-balance"
          hint={
            account
              ? 'Modifier ce montant décale tous les soldes calculés de ce compte.'
              : 'Le solde du compte au moment où vous commencez à le suivre.'
          }
          error={state.fieldErrors?.initialBalance}
        >
          <Input
            id="account-balance"
            name="initialBalance"
            inputMode="decimal"
            defaultValue={account ? formatAmount(account.initialBalance) : ''}
            placeholder="0,00"
            className="tabular"
            invalid={Boolean(state.fieldErrors?.initialBalance)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Devise"
          htmlFor="account-currency"
          required
          error={state.fieldErrors?.currency}
        >
          <Select
            id="account-currency"
            name="currency"
            defaultValue={account?.currency ?? householdCurrency}
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {currencyLabels[code]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Titulaire"
          htmlFor="account-owner"
          hint="Qui détient ce compte. Laissez vide s’il n’appartient à personne en particulier."
          error={state.fieldErrors?.ownerUserId}
        >
          <Select
            id="account-owner"
            name="ownerUserId"
            defaultValue={account?.ownerUserId ?? ''}
          >
            <option value="">Non précisé</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Couleur */}
      <fieldset>
        <legend className="mb-2 block text-sm font-medium">Couleur</legend>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setColor(value)}
              aria-pressed={color === value}
              aria-label={`Couleur ${value}`}
              className={cn(
                'flex size-9 items-center justify-center rounded-lg transition-transform',
                color === value ? 'ring-2 ring-ring ring-offset-2 ring-offset-card' : 'hover:scale-105',
              )}
              style={{ backgroundColor: value }}
            >
              {color === value && (
                <Check className="size-4 text-white" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Icône */}
      <fieldset>
        <legend className="mb-2 block text-sm font-medium">Icône</legend>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_ICONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setIcon(value)}
              aria-pressed={icon === value}
              aria-label={`Icône ${value}`}
              className={cn(
                'flex size-9 items-center justify-center rounded-lg border transition-colors',
                icon === value
                  ? 'border-ring bg-primary-soft text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon name={value} className="size-4.5" />
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-2.5 rounded-xl border border-border p-3">
        <input
          type="checkbox"
          name="isShared"
          defaultChecked={account?.isShared ?? true}
          className="mt-0.5 size-4 rounded border-input"
        />
        <span className="text-sm">
          <span className="font-medium">Compte partagé avec le foyer</span>
          <span className="mt-0.5 block text-muted-foreground">
            Décochez pour un compte strictement personnel. Il restera visible par les
            membres du foyer, mais sera clairement identifié comme le vôtre.
          </span>
        </span>
      </label>

      <div className="flex gap-2">
        <SubmitButton>{account ? 'Enregistrer' : 'Créer le compte'}</SubmitButton>
        <Button variant="ghost" onClick={onFinished}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
