'use client'

import { useActionState, useCallback, useState } from 'react'
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react'

import { CategoryForm } from '@/app/(app)/categories/category-form'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  deleteCategoryAction,
  toggleCategoryArchiveAction,
} from '@/lib/actions/category'
import {
  categoryKindDescriptions,
  categoryKindLabels,
  categoryKindOrder,
} from '@/lib/categories'
import { idleFormState } from '@/lib/forms'
import { cn } from '@/lib/utils'
import type { CategoryKind } from '@/types/database'

export type CategoryRow = {
  id: string
  name: string
  categoryType: CategoryKind
  icon: string
  color: string
  parentCategoryId: string | null
  isActive: boolean
  isSystem: boolean
  transactionCount: number
}

export function CategoriesManager({
  categories,
  canWrite,
}: {
  categories: CategoryRow[]
  canWrite: boolean
}) {
  /** null = fermé ; { kind } = création ; { id } = modification. */
  const [panel, setPanel] = useState<
    { mode: 'create'; kind: CategoryKind } | { mode: 'edit'; id: string } | null
  >(null)
  const [showArchived, setShowArchived] = useState(false)

  const [archiveState, archiveAction] = useActionState(
    toggleCategoryArchiveAction,
    idleFormState,
  )
  const [deleteState, deleteAction] = useActionState(deleteCategoryAction, idleFormState)

  const closePanel = useCallback(() => setPanel(null), [])

  const topLevel = categories.filter((category) => category.parentCategoryId === null)
  const editingCategory =
    panel?.mode === 'edit' ? categories.find((c) => c.id === panel.id) : undefined

  const archivedCount = categories.filter((category) => !category.isActive).length

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

      {panel && (
        <Card>
          <CardBody>
            <h2 className="mb-4 text-base font-semibold">
              {editingCategory
                ? `Modifier « ${editingCategory.name} »`
                : 'Nouvelle catégorie'}
            </h2>
            <CategoryForm
              key={panel.mode === 'edit' ? panel.id : `new-${panel.kind}`}
              category={editingCategory}
              parentOptions={topLevel}
              defaultKind={panel.mode === 'create' ? panel.kind : undefined}
              onFinished={closePanel}
            />
          </CardBody>
        </Card>
      )}

      {archivedCount > 0 && (
        <label className="flex w-fit items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="size-4 rounded border-input"
          />
          Afficher les {archivedCount} catégories archivées
        </label>
      )}

      {categoryKindOrder.map((kind) => {
        const parents = topLevel.filter(
          (category) =>
            category.categoryType === kind && (showArchived || category.isActive),
        )

        // Une section vide n'est affichée que si l'utilisateur peut y ajouter
        // quelque chose : sinon c'est du bruit.
        if (parents.length === 0 && !canWrite) return null

        return (
          <Card key={kind}>
            <CardHeader
              title={categoryKindLabels[kind]}
              description={categoryKindDescriptions[kind]}
              action={
                canWrite ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPanel({ mode: 'create', kind })}
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    Ajouter
                  </Button>
                ) : undefined
              }
            />
            <CardBody className="pt-3">
              {parents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune catégorie dans cette section.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {parents.map((category) => (
                    <CategoryItem
                      key={category.id}
                      category={category}
                      subcategories={categories.filter(
                        (child) =>
                          child.parentCategoryId === category.id &&
                          (showArchived || child.isActive),
                      )}
                      canWrite={canWrite}
                      onEdit={(id) => setPanel({ mode: 'edit', id })}
                      archiveAction={archiveAction}
                      deleteAction={deleteAction}
                    />
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )
      })}
    </div>
  )
}

function CategoryItem({
  category,
  subcategories,
  canWrite,
  onEdit,
  archiveAction,
  deleteAction,
  isChild = false,
}: {
  category: CategoryRow
  subcategories?: CategoryRow[]
  canWrite: boolean
  onEdit: (id: string) => void
  archiveAction: (formData: FormData) => void
  deleteAction: (formData: FormData) => void
  isChild?: boolean
}) {
  return (
    <li className={cn(isChild && 'border-t border-border')}>
      <div
        className={cn(
          'flex flex-wrap items-center gap-3 py-2.5',
          isChild && 'pl-6',
          !category.isActive && 'opacity-60',
        )}
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: category.color }}
        >
          <Icon name={category.icon} className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{category.name}</p>
          {category.transactionCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {category.transactionCount} opération
              {category.transactionCount > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {!category.isActive && (
          <Badge tone="neutral" icon={<Archive className="size-3" aria-hidden="true" />}>
            Archivée
          </Badge>
        )}

        {canWrite && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(category.id)}
              aria-label={`Modifier ${category.name}`}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </Button>

            <form action={archiveAction}>
              <input type="hidden" name="categoryId" value={category.id} />
              <SubmitButton
                variant="ghost"
                size="sm"
                aria-label={
                  category.isActive
                    ? `Archiver ${category.name}`
                    : `Réactiver ${category.name}`
                }
              >
                {category.isActive ? (
                  <Archive className="size-3.5" aria-hidden="true" />
                ) : (
                  <ArchiveRestore className="size-3.5" aria-hidden="true" />
                )}
              </SubmitButton>
            </form>

            {/* Supprimer n'est proposé que sur une catégorie inutilisée :
                ailleurs, l'archivage préserve l'historique. */}
            {category.transactionCount === 0 && (subcategories ?? []).length === 0 && (
              <form action={deleteAction}>
                <input type="hidden" name="categoryId" value={category.id} />
                <SubmitButton
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  aria-label={`Supprimer ${category.name}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </SubmitButton>
              </form>
            )}
          </div>
        )}
      </div>

      {(subcategories ?? []).length > 0 && (
        <ul>
          {(subcategories ?? []).map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              canWrite={canWrite}
              onEdit={onEdit}
              archiveAction={archiveAction}
              deleteAction={deleteAction}
              isChild
            />
          ))}
        </ul>
      )}
    </li>
  )
}
