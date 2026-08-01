'use client'

import { useActionState, useMemo, useState } from 'react'
import { AlertTriangle, Check, Copy, HelpCircle } from 'lucide-react'

import type { ImportCategoryOption } from '@/app/(app)/import/import-wizard'
import { Alert } from '@/components/ui/alert'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { commitImportAction } from '@/lib/actions/import'
import { expectedCategoryKinds } from '@/lib/banking/categorize'
import type { ColumnMapping } from '@/lib/banking/detect-columns'
import {
  summarizeImportRecap,
  type ImportRowPreview,
  type RowStatus,
} from '@/lib/banking/import-pipeline'
import type { DateOrder } from '@/lib/banking/parse-date'
import type { DecimalSeparator } from '@/lib/banking/parse-amount'
import { categoryKindLabels } from '@/lib/categories'
import { formatDate, formatMoney } from '@/lib/format'
import { idleFormState } from '@/lib/forms'
import { cn } from '@/lib/utils'
import type { SupportedFileType } from '@/lib/banking/read-file'

/** Classes de texte statiques : Tailwind ne peut pas composer une classe dynamique. */
const TONE_TEXT_CLASS: Partial<Record<BadgeTone, string>> = {
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  neutral: 'text-muted-foreground',
}

const STATUS_CONFIG: Record<RowStatus, { label: string; tone: BadgeTone }> = {
  recognized: { label: 'Reconnue', tone: 'success' },
  suggested: { label: 'Proposée', tone: 'primary' },
  unrecognized: { label: 'À vérifier', tone: 'warning' },
  duplicate: { label: 'Doublon', tone: 'danger' },
  similar: { label: 'À vérifier', tone: 'warning' },
  invalid: { label: 'Ignorée', tone: 'neutral' },
}

export function ImportPreviewStep({
  initialRows,
  categories,
  accountId,
  accountLabel,
  fileName,
  fileType,
  headerSignature,
  mapping,
  dateOrder,
  decimalSeparator,
  rememberedProfileName,
  onStartOver,
}: {
  initialRows: ImportRowPreview[]
  categories: ImportCategoryOption[]
  accountId: string
  accountLabel: string
  fileName: string
  fileType: SupportedFileType
  headerSignature: string
  mapping: ColumnMapping
  dateOrder: DateOrder
  decimalSeparator: DecimalSeparator
  rememberedProfileName: string | null
  onStartOver: () => void
}) {
  const [rows, setRows] = useState(initialRows)
  const [saveProfile, setSaveProfile] = useState(rememberedProfileName === null)
  const [commitState, commitAction] = useActionState(commitImportAction, idleFormState)

  const recap = useMemo(() => summarizeImportRecap(rows), [rows])
  const includedRows = useMemo(() => rows.filter((row) => row.included), [rows])

  const rowsPayload = useMemo(
    () =>
      includedRows
        .filter((row) => row.parsedDate !== null && row.parsedAmount !== null && row.fingerprint !== null)
        .map((row) => ({
          rowIndex: row.rowIndex,
          date: row.parsedDate,
          rawLabel: row.rawLabel,
          normalizedLabel: row.normalizedLabel,
          merchant: row.merchant,
          amount: row.parsedAmount,
          categoryId: row.selectedCategoryId ?? '',
          fingerprint: row.fingerprint,
          isDuplicate: row.status === 'duplicate',
          rememberMerchant: Boolean(row.selectedCategoryId) && row.merchant !== '',
        })),
    [includedRows],
  )

  function toggleIncluded(rowIndex: number) {
    setRows((current) =>
      current.map((row) => (row.rowIndex === rowIndex ? { ...row, included: !row.included } : row)),
    )
  }

  function changeCategory(rowIndex: number, categoryId: string) {
    setRows((current) =>
      current.map((row) =>
        row.rowIndex === rowIndex ? { ...row, selectedCategoryId: categoryId || null } : row,
      ),
    )
  }

  const hasDebitCredit = mapping.debit !== undefined && mapping.credit !== undefined

  if (commitState.status === 'success') {
    return (
      <Card>
        <CardBody className="space-y-4">
          <Alert tone="success">{commitState.message}</Alert>
          <Button onClick={onStartOver}>Importer un autre fichier</Button>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Aperçu avant validation"
          description={`${fileName} — compte « ${accountLabel} »`}
        />
        <CardBody className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <RecapItem label="Total" value={recap.total} />
            <RecapItem label="Nouvelles" value={recap.nouvelles} tone="success" />
            <RecapItem label="Doublons" value={recap.doublons} tone="danger" />
            <RecapItem label="À vérifier" value={recap.aVerifier} tone="warning" />
            <RecapItem label="Ignorées" value={recap.ignorees} tone="neutral" />
          </dl>

          {recap.ignorees > 0 && (
            <Alert tone="warning">
              {recap.ignorees} ligne{recap.ignorees > 1 ? 's' : ''} n’a pas pu être analysée
              (date ou montant illisible) et ne sera pas importée.
            </Alert>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted text-xs">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Libellé</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Montant</th>
                <th className="px-3 py-2 text-left font-medium">Catégorie</th>
                <th className="px-3 py-2 text-left font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <PreviewRow
                  key={row.rowIndex}
                  row={row}
                  categories={categories}
                  onToggleIncluded={() => toggleIncluded(row.rowIndex)}
                  onChangeCategory={(categoryId) => changeCategory(row.rowIndex, categoryId)}
                />
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          {commitState.status === 'error' && commitState.message && (
            <Alert tone="danger">{commitState.message}</Alert>
          )}

          <form action={commitAction} className="space-y-4">
            <input type="hidden" name="accountId" value={accountId} />
            <input type="hidden" name="fileName" value={fileName} />
            <input type="hidden" name="fileType" value={fileType} />
            <input type="hidden" name="rowsJson" value={JSON.stringify(rowsPayload)} readOnly />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="saveProfile"
                checked={saveProfile}
                onChange={(event) => setSaveProfile(event.target.checked)}
                className="size-4 rounded border-input"
              />
              Mémoriser le format de cette banque pour les prochains imports
            </label>

            {saveProfile && (
              <>
                <input type="hidden" name="headerSignature" value={headerSignature} />
                <input type="hidden" name="columnMappingJson" value={JSON.stringify(mapping)} readOnly />
                <input type="hidden" name="dateFormat" value={dateOrder} />
                <input type="hidden" name="decimalSeparator" value={decimalSeparator} />
                <input type="hidden" name="hasDebitCredit" value={hasDebitCredit ? 'on' : ''} />

                <Field label="Nom de ce format" htmlFor="profile-name" required>
                  <Input
                    id="profile-name"
                    name="profileName"
                    required
                    maxLength={80}
                    defaultValue={rememberedProfileName ?? ''}
                    placeholder="Ex. : Crédit Agricole — export CSV"
                  />
                </Field>
              </>
            )}

            <SubmitButton disabled={rowsPayload.length === 0}>
              Valider l’import ({rowsPayload.length} opération{rowsPayload.length > 1 ? 's' : ''})
            </SubmitButton>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

function RecapItem({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: BadgeTone
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 text-xl font-bold', tone && TONE_TEXT_CLASS[tone])}>{value}</dd>
    </div>
  )
}

function PreviewRow({
  row,
  categories,
  onToggleIncluded,
  onChangeCategory,
}: {
  row: ImportRowPreview
  categories: ImportCategoryOption[]
  onToggleIncluded: () => void
  onChangeCategory: (categoryId: string) => void
}) {
  const status = STATUS_CONFIG[row.status]
  const canPickCategory = row.status !== 'invalid'
  const relevantKinds = canPickCategory ? expectedCategoryKinds(row.parsedAmount ?? 0) : []

  return (
    <tr className={row.status === 'invalid' ? 'opacity-50' : undefined}>
      <td className="px-3 py-2 align-top">
        {row.status !== 'invalid' && (
          <input
            type="checkbox"
            checked={row.included}
            onChange={onToggleIncluded}
            aria-label={row.included ? 'Exclure cette ligne' : 'Inclure cette ligne'}
            className="size-4 rounded border-input"
          />
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 align-top">
        {row.parsedDate ? formatDate(row.parsedDate) : row.rawDate || '—'}
      </td>
      <td className="max-w-64 px-3 py-2 align-top">
        <p className="truncate" title={row.rawLabel}>
          {row.rawLabel}
        </p>
        {row.status === 'similar' && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-warning">
            <HelpCircle className="size-3" aria-hidden="true" />
            {row.categoryReason}
          </p>
        )}
        {row.status === 'duplicate' && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-danger">
            <Copy className="size-3" aria-hidden="true" />
            {row.categoryReason}
          </p>
        )}
        {row.status === 'invalid' && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <AlertTriangle className="size-3" aria-hidden="true" />
            {row.categoryReason}
          </p>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular">
        {row.parsedAmount !== null ? formatMoney(row.parsedAmount, undefined, { showSign: true }) : '—'}
      </td>
      <td className="min-w-40 px-3 py-2 align-top">
        {canPickCategory ? (
          <Select
            aria-label="Catégorie"
            value={row.selectedCategoryId ?? ''}
            onChange={(event) => onChangeCategory(event.target.value)}
            className="h-9 text-xs"
          >
            <option value="">Aucune — à vérifier</option>
            {relevantKinds.map((kind) => {
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
        ) : (
          '—'
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 align-top">
        <Badge tone={status.tone} icon={row.status === 'recognized' ? <Check className="size-3" aria-hidden="true" /> : undefined}>
          {status.label}
        </Badge>
      </td>
    </tr>
  )
}
