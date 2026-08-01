'use client'

import { useActionState, useState } from 'react'
import { Home, Ticket } from 'lucide-react'

import { createHouseholdAction, joinHouseholdAction } from '@/lib/actions/household'
import { Alert } from '@/components/ui/alert'
import { Field, Input, Select } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleFormState } from '@/lib/forms'
import { SUPPORTED_CURRENCIES, currencyLabels } from '@/lib/validation/household'
import { cn } from '@/lib/utils'

type Mode = 'create' | 'join'

const tabs: { value: Mode; label: string; icon: typeof Home }[] = [
  { value: 'create', label: 'Créer un foyer', icon: Home },
  { value: 'join', label: 'Rejoindre', icon: Ticket },
]

export function Onboarding({ defaultCode }: { defaultCode?: string }) {
  // Si l'utilisateur arrive avec un code d'invitation, on ouvre directement
  // le bon onglet plutôt que de lui demander de le chercher.
  const [mode, setMode] = useState<Mode>(defaultCode ? 'join' : 'create')

  const [createState, createFormAction] = useActionState(createHouseholdAction, idleFormState)
  const [joinState, joinFormAction] = useActionState(joinHouseholdAction, idleFormState)

  return (
    <div>
      <div role="tablist" aria-label="Comment démarrer" className="mb-5 flex gap-1 rounded-xl bg-muted p-1">
        {tabs.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            aria-controls={`panneau-${value}`}
            id={`onglet-${value}`}
            onClick={() => setMode(value)}
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

      {mode === 'create' && (
        <form
          action={createFormAction}
          id="panneau-create"
          role="tabpanel"
          aria-labelledby="onglet-create"
          className="space-y-4"
          noValidate
        >
          {createState.status === 'error' && createState.message && (
            <Alert tone="danger">{createState.message}</Alert>
          )}

          <Field
            label="Nom du foyer"
            htmlFor="name"
            required
            hint="Par exemple « Famille Dupont » ou « Appartement Nation »."
            error={createState.fieldErrors?.name}
          >
            <Input
              id="name"
              name="name"
              required
              autoFocus
              maxLength={80}
              placeholder="Notre foyer"
              invalid={Boolean(createState.fieldErrors?.name)}
            />
          </Field>

          <Field
            label="Devise"
            htmlFor="currency"
            required
            hint="Elle s’appliquera à tous les comptes et budgets du foyer."
            error={createState.fieldErrors?.currency}
          >
            <Select
              id="currency"
              name="currency"
              defaultValue="EUR"
              invalid={Boolean(createState.fieldErrors?.currency)}
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {currencyLabels[code]}
                </option>
              ))}
            </Select>
          </Field>

          <SubmitButton block size="lg">
            Créer mon foyer
          </SubmitButton>

          <p className="text-center text-xs text-muted-foreground">
            Vingt-cinq catégories courantes seront créées automatiquement. Vous pourrez
            les renommer, en ajouter ou les archiver.
          </p>
        </form>
      )}

      {mode === 'join' && (
        <form
          action={joinFormAction}
          id="panneau-join"
          role="tabpanel"
          aria-labelledby="onglet-join"
          className="space-y-4"
          noValidate
        >
          {joinState.status === 'error' && joinState.message && (
            <Alert tone="danger">{joinState.message}</Alert>
          )}

          <Field
            label="Code d’invitation"
            htmlFor="code"
            required
            hint="Le code que vous a transmis un administrateur du foyer."
            error={joinState.fieldErrors?.code}
          >
            <Input
              id="code"
              name="code"
              required
              autoFocus={Boolean(defaultCode)}
              defaultValue={defaultCode}
              maxLength={20}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="A1B2C3D4E5F6"
              className="font-mono tracking-widest uppercase"
              invalid={Boolean(joinState.fieldErrors?.code)}
            />
          </Field>

          <SubmitButton block size="lg">
            Rejoindre le foyer
          </SubmitButton>

          <p className="text-center text-xs text-muted-foreground">
            Vous n’avez pas de code ? Demandez à la personne qui gère le budget de vous
            en générer un depuis la page Foyer.
          </p>
        </form>
      )}
    </div>
  )
}
