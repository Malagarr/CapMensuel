'use client'

import { useActionState, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CircleHelp,
  Copy,
  FileWarning,
  ThumbsUp,
} from 'lucide-react'

import { commitImportAction, type ImportContext } from '@/lib/actions/import'
import { Alert } from '@/components/ui/alert'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { categoryKindOrder, categoryKindLabels } from '@/lib/categories'
import { idleFormState } from '@/lib/forms'
import { formatDate, formatMoney } from '@/lib/format'
import type { analyzeSheet } from '@/lib/banking/import-pipeline'
import { buildImportPreview, summarizePreview, type ImportRowPreview, type RowStatus } from '@/lib/banking/import-pipeline'
import type { SupportedFileType } from '@/lib/banking/read-file'
import { cn } from '@/lib/utils'

type SheetAnalysis = ReturnType<typeof analyzeSheet>

const statusMeta: Record<RowStatus, { label: string; tone: BadgeTone; icon: typeof Check }> = {
  recognized: { label: 'Reconnue', tone: 'success', icon: Check },
  suggested: { label: 'À confirmer', tone: 'warning', icon: ThumbsUp },
  unrecognized: { label: 'Non reconnue', tone: 'neutral', icon: CircleHelp },
  duplicate: { label: 'Doublon', tone: 'danger', icon: Copy },
  similar: { label: 'À vérifier', tone: 'warning', icon: AlertTriangle },
  invalid: { label: 'Ignorée', tone: 'neutral', icon: FileWarning },
}

export function PreviewStep({
  fileName,
  fileType,
  analysis,
  context,
  accountId,
  currency,
  onRestart,
}: {
  fileName: string
  fileType: SupportedFileType
  analysis: SheetAnalysis
  context: ImportContext
  accountId: string
  currency: string
  onRestart: () => void
}) {
  // L'aperçu est calculé une fois, à l'ouverture de cette étape : c'est un
  // calcul pur et déterministe, inutile de le refaire à chaque rendu.
  const initialRows = useMemo(
    () =>
      buildImportPreview({
        dataRows: analysis.dataRows,
        mapping: analysis.mapping,
        dateOrder: analysis.dateOrder,
        decimalSeparator: analysis.decimalSeparator,
        accountId,
        existingOperations: context.existingOperations,
        categorization: context.categorization,
      }),
    [analysis, accountId, context],
  )

  const [rows, setRows] = useState(initialRows)
  // Coché par défaut seulement si la détection du format était certaine :
  // sur un format ambigu, mieux vaut laisser l'utilisateur décider.
  const [saveProfile, setSaveProfile] = useState(analysis.dateOrderCertain)
  // Préremplie pour qu'un envoi sans y toucher reste valide : le nom est
  // requis dès lors que la case « mémoriser » est cochée.
  const [profileName, setProfileName] = useState(() =>
    fileName.replace(/\.[a-zA-Z0-9]+$/, '').slice(0, 80),
  )

  const [state, formAction] = useActionState(commitImportAction, idleFormState)

  const summary = useMemo(() => summarizePreview(rows), [rows])
  const activeCategories = context.categorization.categories.filter((c) => c.isActive)

  function updateRow(rowIndex: number, patch: Partial<ImportRowPreview>) {
    setRows((current) =>
      current.map((row) => (row.rowIndex === rowIndex ? { ...row, ...patch } : row)),
    )
  }

  function toggleIncluded(rowIndex: number, included: boolean) {
    updateRow(rowIndex, { included })
  }

  // Un choix différent de la suggestion vaut correction de l'utilisateur :
  // la comparaison avec suggestedCategoryId, au moment de construire le
  // payload plus bas, décide alors de mémoriser ce commerçant (§10).
  function changeCategory(rowIndex: number, categoryId: string) {
    setRows((current) =>
      current.map((row) =>
        row.rowIndex === rowIndex ? { ...row, selectedCategoryId: categoryId || null } : row,
      ),
    )
  }

  // Les lignes réellement importables : ni invalides, ni décochées par l'utilisateur.
  const includedRows = rows.filter((row) => row.included && row.status !== 'invalid')

  const payload = includedRows.map((row) => ({
    rowIndex: row.rowIndex,
    date: row.parsedDate!,
    rawLabel: row.rawLabel,
    normalizedLabel: row.normalizedLabel,
    merchant: row.merchant,
    amount: row.parsedAmount!,
    categoryId: row.selectedCategoryId ?? '',
    fingerprint: row.fingerprint!,
    isDuplicate: row.status === 'duplicate' || row.status === 'similar',
    rememberMerchant:
      row.selectedCategoryId !== null && row.selectedCategoryId !== row.suggestedCategoryId,
  }))

  const columnMappingJson = JSON.stringify(analysis.mapping)

  if (state.status === 'success') {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <span
            className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-success-soft text-success"
            aria-hidden="true"
          >
            <Check className="size-6" />
          </span>
          <p className="font-medium">{state.message}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={onRestart}>Importer un autre fichier</Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {state.status === 'error' && state.message && <Alert tone="danger">{state.message}</Alert>}

      <Card>
        <CardHeader
          title="Aperçu avant validation"
          description={`${fileName} · ${rows.length} ligne${rows.length > 1 ? 's' : ''} détectée${rows.length > 1 ? 's' : ''}`}
        />
        <CardBody className="pt-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile label="Total" value={summary.total} />
            <SummaryTile label="Reconnues" value={summary.recognized} tone="success" />
            <SummaryTile label="À confirmer" value={summary.suggested + summary.unrecognized} tone="warning" />
            <SummaryTile label="Doublons" value={summary.duplicates + summary.similar} tone="danger" />
          </div>
          {summary.invalid > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {summary.invalid} ligne{summary.invalid > 1 ? 's' : ''} illisible
              {summary.invalid > 1 ? 's' : ''} (date ou montant incompréhensible) ne sera
              {summary.invalid > 1 ? 'ont' : ''} pas importée{summary.invalid > 1 ? 's' : ''}.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="max-h-[32rem] overflow-y-auto p-0">
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <PreviewRow
                key={row.rowIndex}
                row={row}
                currency={currency}
                categories={activeCategories}
                onToggleIncluded={(included) => toggleIncluded(row.rowIndex, included)}
                onChangeCategory={(categoryId) => changeCategory(row.rowIndex, categoryId)}
              />
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="accountId" value={accountId} />
            <input type="hidden" name="fileName" value={fileName} />
            <input type="hidden" name="fileType" value={fileType} />
            <input type="hidden" name="rowsJson" value={JSON.stringify(payload)} />
            <input type="hidden" name="headerSignature" value={analysis.signature} />
            <input type="hidden" name="columnMappingJson" value={columnMappingJson} />
            <input type="hidden" name="dateFormat" value={analysis.dateOrder} />
            <input type="hidden" name="decimalSeparator" value={analysis.decimalSeparator} />
            <input
              type="hidden"
              name="hasDebitCredit"
              value={analysis.mapping.debit !== undefined || analysis.mapping.credit !== undefined ? 'on' : ''}
            />

            <label className="flex items-start gap-2.5 rounded-xl border border-border p-3">
              <input
                type="checkbox"
                name="saveProfile"
                checked={saveProfile}
                onChange={(event) => setSaveProfile(event.target.checked)}
                className="mt-0.5 size-4 rounded border-input"
              />
              <span className="text-sm">
                <span className="font-medium">Mémoriser ce format de fichier</span>
                <span className="mt-0.5 block text-muted-foreground">
                  Les prochains relevés de cette banque seront reconnus automatiquement.
                </span>
              </span>
            </label>

            {saveProfile && (
              <div>
                <label htmlFor="profile-name" className="mb-1.5 block text-sm font-medium">
                  Nom pour reconnaître cette banque
                </label>
                <input
                  id="profile-name"
                  name="profileName"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Ex. Crédit Agricole"
                  maxLength={80}
                  className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm focus:border-ring"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton size="lg" disabled={includedRows.length === 0}>
                Importer {includedRows.length} opération{includedRows.length > 1 ? 's' : ''}
              </SubmitButton>
              <Button type="button" variant="ghost" onClick={onRestart}>
                Annuler
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'success' | 'warning' | 'danger'
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'tabular text-xl font-bold',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function PreviewRow({
  row,
  currency,
  categories,
  onToggleIncluded,
  onChangeCategory,
}: {
  row: ImportRowPreview
  currency: string
  categories: { id: string; name: string; categoryType: string }[]
  onToggleIncluded: (included: boolean) => void
  onChangeCategory: (categoryId: string) => void
}) {
  const meta = statusMeta[row.status]
  const Icon = meta.icon

  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-3 px-4 py-2.5',
        row.status === 'invalid' && 'opacity-60',
      )}
    >
      <input
        type="checkbox"
        checked={row.included}
        onChange={(event) => onToggleIncluded(event.target.checked)}
        disabled={row.status === 'invalid'}
        aria-label={`Inclure « ${row.rawLabel} » dans l’import`}
        className="size-4 rounded border-input"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.rawLabel}</p>
        <p className="text-xs text-muted-foreground">
          {row.parsedDate ? formatDate(row.parsedDate) : row.rawDate || '—'}
          {row.duplicateOfId && ' · ' + meta.label.toLowerCase()}
        </p>
      </div>

      <span
        className={cn(
          'tabular whitespace-nowrap text-sm font-semibold',
          row.parsedAmount !== null && row.parsedAmount < 0 ? 'text-expense' : 'text-income',
        )}
      >
        {row.parsedAmount !== null ? formatMoney(row.parsedAmount, currency, { showSign: true }) : row.rawAmount}
      </span>

      <Badge tone={meta.tone} icon={<Icon className="size-3" aria-hidden="true" />}>
        {meta.label}
      </Badge>

      {row.status !== 'invalid' && (
        <select
          value={row.selectedCategoryId ?? ''}
          onChange={(event) => onChangeCategory(event.target.value)}
          aria-label={`Catégorie de « ${row.rawLabel} »`}
          className="h-9 min-w-40 rounded-lg border border-input bg-card px-2 text-sm"
        >
          <option value="">Sans catégorie</option>
          {categoryKindOrder.map((kind) => {
            const options = categories.filter((c) => c.categoryType === kind)
            if (options.length === 0) return null
            return (
              <optgroup key={kind} label={categoryKindLabels[kind]}>
                {options.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
      )}
    </li>
  )
}
