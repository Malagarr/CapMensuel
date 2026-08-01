'use client'

import { useActionState, useCallback, useState } from 'react'
import { Pause, Pencil, Play, Plus, Wand2 } from 'lucide-react'

import { RuleForm } from '@/app/(app)/regles/rule-form'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { applyRuleToPastAction, toggleRuleActiveAction } from '@/lib/actions/rule'
import { idleFormState } from '@/lib/forms'
import { cn } from '@/lib/utils'
import type { CategoryKind, RuleMatchType } from '@/types/database'

export type RuleRow = {
  id: string
  ruleName: string
  matchType: RuleMatchType
  matchValue: string
  categoryId: string
  categoryName: string
  accountId: string | null
  accountName: string | null
  priority: number
  isActive: boolean
  hitCount: number
}

export type RuleCategoryOption = {
  id: string
  name: string
  categoryType: CategoryKind
  parentName: string | null
}

export type RuleAccountOption = {
  id: string
  name: string
}

export const matchTypeLabels: Record<RuleMatchType, string> = {
  contains: 'Contient',
  equals: 'Est exactement',
  starts_with: 'Commence par',
  ends_with: 'Se termine par',
  regex: 'Expression régulière',
}

export function RulesManager({
  rules,
  categories,
  accounts,
  canWrite,
}: {
  rules: RuleRow[]
  categories: RuleCategoryOption[]
  accounts: RuleAccountOption[]
  canWrite: boolean
}) {
  const [panel, setPanel] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(
    null,
  )
  const [showInactive, setShowInactive] = useState(false)

  const [toggleState, toggleAction] = useActionState(toggleRuleActiveAction, idleFormState)
  const [applyState, applyAction] = useActionState(applyRuleToPastAction, idleFormState)

  const closePanel = useCallback(() => setPanel(null), [])

  const editingRule = panel?.mode === 'edit' ? rules.find((r) => r.id === panel.id) : undefined
  const inactiveCount = rules.filter((rule) => !rule.isActive).length
  const visibleRules = rules.filter((rule) => showInactive || rule.isActive)

  return (
    <div className="space-y-4">
      {toggleState.status === 'error' && toggleState.message && (
        <Alert tone="danger">{toggleState.message}</Alert>
      )}
      {toggleState.status === 'success' && toggleState.message && (
        <Alert tone="success">{toggleState.message}</Alert>
      )}
      {applyState.status === 'error' && applyState.message && (
        <Alert tone="danger">{applyState.message}</Alert>
      )}
      {applyState.status === 'success' && applyState.message && (
        <Alert tone="success">{applyState.message}</Alert>
      )}

      {panel && canWrite && (
        <Card>
          <CardBody>
            <h2 className="mb-4 text-base font-semibold">
              {editingRule ? `Modifier « ${editingRule.ruleName} »` : 'Nouvelle règle'}
            </h2>
            <RuleForm
              key={panel.mode === 'edit' ? panel.id : 'new'}
              rule={editingRule}
              categories={categories}
              accounts={accounts}
              onFinished={closePanel}
            />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Vos règles"
          description="Classées par priorité décroissante : la première qui correspond l’emporte."
          action={
            canWrite ? (
              <Button variant="outline" size="sm" onClick={() => setPanel({ mode: 'create' })}>
                <Plus className="size-3.5" aria-hidden="true" />
                Nouvelle règle
              </Button>
            ) : undefined
          }
        />
        <CardBody className="space-y-3 pt-3">
          {inactiveCount > 0 && (
            <label className="flex w-fit items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="size-4 rounded border-input"
              />
              Afficher les {inactiveCount} règles désactivées
            </label>
          )}

          {visibleRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune règle pour l’instant. Les opérations sont classées par mots-clés et par
              votre historique de corrections.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {visibleRules.map((rule) => (
                <li key={rule.id} className={cn('py-3', !rule.isActive && 'opacity-60')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{rule.ruleName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {matchTypeLabels[rule.matchType]} « {rule.matchValue} » → {rule.categoryName}
                        {rule.accountName ? ` — ${rule.accountName} uniquement` : ' — tous les comptes'}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Priorité {rule.priority} · appliquée {rule.hitCount} fois
                        {!rule.isActive && ' · désactivée'}
                      </p>
                    </div>

                    {canWrite && (
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPanel({ mode: 'edit', id: rule.id })}
                          aria-label={`Modifier ${rule.ruleName}`}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>

                        <form action={toggleAction}>
                          <input type="hidden" name="ruleId" value={rule.id} />
                          <SubmitButton
                            variant="ghost"
                            size="sm"
                            aria-label={rule.isActive ? `Désactiver ${rule.ruleName}` : `Réactiver ${rule.ruleName}`}
                          >
                            {rule.isActive ? (
                              <Pause className="size-3.5" aria-hidden="true" />
                            ) : (
                              <Play className="size-3.5" aria-hidden="true" />
                            )}
                          </SubmitButton>
                        </form>

                        {rule.isActive && (
                          <form action={applyAction}>
                            <input type="hidden" name="ruleId" value={rule.id} />
                            <SubmitButton
                              variant="ghost"
                              size="sm"
                              aria-label={`Appliquer ${rule.ruleName} aux anciennes opérations`}
                              title="Appliquer aux anciennes opérations sans catégorie"
                            >
                              <Wand2 className="size-3.5" aria-hidden="true" />
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
