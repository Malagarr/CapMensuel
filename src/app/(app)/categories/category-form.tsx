'use client'

import { useActionState, useEffect, useState } from 'react'
import { Check } from 'lucide-react'

import { saveCategoryAction } from '@/lib/actions/category'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  categoryKindDescriptions,
  categoryKindLabels,
  categoryKindOrder,
} from '@/lib/categories'
import { idleFormState } from '@/lib/forms'
import { cn } from '@/lib/utils'
import type { CategoryKind } from '@/types/database'
import type { CategoryRow } from '@/app/(app)/categories/categories-manager'

export function CategoryForm({
  category,
  parentOptions,
  defaultKind,
  onFinished,
}: {
  category?: CategoryRow
  /** Catégories de premier niveau pouvant servir de parent. */
  parentOptions: CategoryRow[]
  defaultKind?: CategoryKind
  onFinished: () => void
}) {
  const [state, formAction] = useActionState(saveCategoryAction, idleFormState)

  const [kind, setKind] = useState<CategoryKind>(
    category?.categoryType ?? defaultKind ?? 'variable_expense',
  )
  const [icon, setIcon] = useState<string>(category?.icon ?? 'circle')
  const [color, setColor] = useState<string>(category?.color ?? CATEGORY_COLORS[19])

  useEffect(() => {
    if (state.status === 'success') onFinished()
  }, [state.status, onFinished])

  // Une sous-catégorie hérite forcément de la nature de son parent : mélanger
  // une dépense sous un revenu fausserait tous les agrégats.
  const availableParents = parentOptions.filter(
    (option) => option.categoryType === kind && option.id !== category?.id,
  )

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {category && <input type="hidden" name="categoryId" value={category.id} />}
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="color" value={color} />

      {state.status === 'error' && state.message && (
        <Alert tone="danger">{state.message}</Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nom"
          htmlFor="category-name"
          required
          error={state.fieldErrors?.name}
        >
          <Input
            id="category-name"
            name="name"
            required
            autoFocus
            maxLength={60}
            defaultValue={category?.name}
            placeholder="Courses"
            invalid={Boolean(state.fieldErrors?.name)}
          />
        </Field>

        <Field
          label="Nature"
          htmlFor="category-kind"
          required
          hint={categoryKindDescriptions[kind]}
          error={state.fieldErrors?.categoryType}
        >
          <Select
            id="category-kind"
            name="categoryType"
            value={kind}
            onChange={(event) => setKind(event.target.value as CategoryKind)}
          >
            {categoryKindOrder.map((value) => (
              <option key={value} value={value}>
                {categoryKindLabels[value]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Catégorie parente"
        htmlFor="category-parent"
        hint={
          availableParents.length === 0
            ? 'Aucune catégorie de cette nature ne peut servir de parent pour l’instant.'
            : 'Facultatif. Permet de regrouper, par exemple « Assurance auto » sous « Véhicule ».'
        }
        error={state.fieldErrors?.parentCategoryId}
      >
        <Select
          id="category-parent"
          name="parentCategoryId"
          defaultValue={category?.parentCategoryId ?? ''}
          disabled={availableParents.length === 0}
        >
          <option value="">Aucune — catégorie principale</option>
          {availableParents.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium">Couleur</legend>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setColor(value)}
              aria-pressed={color === value}
              aria-label={`Couleur ${value}`}
              className={cn(
                'flex size-8 items-center justify-center rounded-lg transition-transform',
                color === value
                  ? 'ring-2 ring-ring ring-offset-2 ring-offset-card'
                  : 'hover:scale-105',
              )}
              style={{ backgroundColor: value }}
            >
              {color === value && <Check className="size-3.5 text-white" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium">Icône</legend>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_ICONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setIcon(value)}
              aria-pressed={icon === value}
              aria-label={`Icône ${value}`}
              className={cn(
                'flex size-8 items-center justify-center rounded-lg border transition-colors',
                icon === value
                  ? 'border-ring bg-primary-soft text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon name={value} className="size-4" />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        <SubmitButton>{category ? 'Enregistrer' : 'Créer la catégorie'}</SubmitButton>
        <Button variant="ghost" onClick={onFinished}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
