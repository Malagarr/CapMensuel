'use client'

import { useMemo, useRef, useState } from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'

import { ColumnMappingStep } from '@/app/(app)/import/column-mapping-step'
import { ImportPreviewStep } from '@/app/(app)/import/preview-step'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/field'
import {
  findImportProfileAction,
  loadImportContextAction,
  type ImportContext,
  type RememberedProfile,
} from '@/lib/actions/import'
import { analyzeSheet, buildImportPreview, type ImportRowPreview } from '@/lib/banking/import-pipeline'
import type { ColumnMapping } from '@/lib/banking/detect-columns'
import type { DateOrder } from '@/lib/banking/parse-date'
import type { DecimalSeparator } from '@/lib/banking/parse-amount'
import { detectFileType, readBankFile, type SupportedFileType } from '@/lib/banking/read-file'
import { cn } from '@/lib/utils'
import type { CategoryKind } from '@/types/database'

export type ImportAccountOption = {
  id: string
  name: string
  bankName: string | null
  icon: string
  color: string
}

export type ImportCategoryOption = {
  id: string
  name: string
  categoryType: CategoryKind
  parentName: string | null
}

type Step = 'drop' | 'analyzing' | 'mapping' | 'preview'

/**
 * Assistant d'import en 5 écrans (§9) : dépôt du fichier, analyse automatique,
 * correspondance manuelle si incertaine, aperçu avant validation, validation.
 *
 * L'écran « analyse automatique » n'a pas de composant dédié : il ne fait que
 * matérialiser l'attente pendant que le fichier est lu et que le contexte de
 * catégorisation est chargé, avant de basculer directement vers l'écran
 * suivant selon ce que l'analyse a trouvé.
 */
export function ImportWizard({
  accounts,
  categories,
}: {
  accounts: ImportAccountOption[]
  categories: ImportCategoryOption[]
}) {
  const [step, setStep] = useState<Step>('drop')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const [fileType, setFileType] = useState<SupportedFileType | null>(null)
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeSheet> | null>(null)
  const [context, setContext] = useState<ImportContext | null>(null)
  const [rememberedProfile, setRememberedProfile] = useState<RememberedProfile | null>(null)

  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [dateOrder, setDateOrder] = useState<DateOrder>('dmy')
  const [decimalSeparator, setDecimalSeparator] = useState<DecimalSeparator>(',')
  const [rows, setRows] = useState<ImportRowPreview[]>([])

  const selectedAccount = accounts.find((account) => account.id === accountId)

  function resetToDrop() {
    setStep('drop')
    setFile(null)
    setError(null)
    setFileType(null)
    setAnalysis(null)
    setContext(null)
    setRememberedProfile(null)
    setMapping({})
    setRows([])
    setFileKey((key) => key + 1)
  }

  function pickFile(candidate: File) {
    const type = detectFileType(candidate.name)
    if (!type) {
      setError('Format non pris en charge. Utilisez un fichier .csv ou .xlsx.')
      return
    }
    setError(null)
    setFile(candidate)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const dropped = event.dataTransfer.files[0]
    if (dropped) pickFile(dropped)
  }

  function buildRows(
    dataRows: readonly string[][],
    activeMapping: ColumnMapping,
    activeDateOrder: DateOrder,
    activeDecimalSeparator: DecimalSeparator,
    ctx: ImportContext,
  ): ImportRowPreview[] {
    return buildImportPreview({
      dataRows,
      mapping: activeMapping,
      dateOrder: activeDateOrder,
      decimalSeparator: activeDecimalSeparator,
      accountId,
      existingOperations: ctx.existingOperations,
      categorization: ctx.categorization,
    })
  }

  async function handleAnalyze() {
    if (!file || !accountId) return

    setStep('analyzing')
    setError(null)

    const result = await readBankFile(file)
    if (!result.success) {
      setError(result.error.message)
      setStep('drop')
      return
    }

    const type = detectFileType(file.name)
    const parsedAnalysis = analyzeSheet(result.sheet)

    let ctx: ImportContext
    let remembered: RememberedProfile | null
    try {
      ;[ctx, remembered] = await Promise.all([
        loadImportContextAction(accountId),
        findImportProfileAction(parsedAnalysis.signature),
      ])
    } catch {
      setError(
        'Impossible de charger vos catégories et règles pour le moment. Vérifiez votre connexion et réessayez.',
      )
      setStep('drop')
      return
    }

    setFileType(type)
    setAnalysis(parsedAnalysis)
    setContext(ctx)
    setRememberedProfile(remembered)

    if (remembered) {
      setMapping(remembered.mapping)
      setDateOrder(remembered.dateFormat)
      setDecimalSeparator(remembered.decimalSeparator)
      setRows(buildRows(parsedAnalysis.dataRows, remembered.mapping, remembered.dateFormat, remembered.decimalSeparator, ctx))
      setStep('preview')
      return
    }

    setMapping(parsedAnalysis.mapping)
    setDateOrder(parsedAnalysis.dateOrder)
    setDecimalSeparator(parsedAnalysis.decimalSeparator)

    if (parsedAnalysis.uncertainFields.length > 0) {
      setStep('mapping')
      return
    }

    setRows(
      buildRows(
        parsedAnalysis.dataRows,
        parsedAnalysis.mapping,
        parsedAnalysis.dateOrder,
        parsedAnalysis.decimalSeparator,
        ctx,
      ),
    )
    setStep('preview')
  }

  function handleMappingConfirm(
    nextMapping: ColumnMapping,
    nextDateOrder: DateOrder,
    nextDecimalSeparator: DecimalSeparator,
  ) {
    if (!analysis || !context) return
    setMapping(nextMapping)
    setDateOrder(nextDateOrder)
    setDecimalSeparator(nextDecimalSeparator)
    setRows(buildRows(analysis.dataRows, nextMapping, nextDateOrder, nextDecimalSeparator, context))
    setStep('preview')
  }

  const sampleRows = useMemo(() => analysis?.dataRows.slice(0, 3) ?? [], [analysis])

  return (
    <div className="space-y-5">
      {error && <Alert tone="danger">{error}</Alert>}

      {(step === 'drop' || step === 'analyzing') && (
        <div className="space-y-4">
          <Field label="Compte concerné" htmlFor="import-account" required>
            <Select
              id="import-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              disabled={step === 'analyzing'}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                  {account.bankName ? ` — ${account.bankName}` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-3 rounded-app border-2 border-dashed p-10 text-center transition-colors',
              isDragging ? 'border-ring bg-primary-soft' : 'border-border hover:bg-muted',
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xlsm"
              className="sr-only"
              onChange={(event) => {
                const selected = event.target.files?.[0]
                if (selected) pickFile(selected)
                event.target.value = ''
              }}
            />
            {file ? (
              <>
                <FileSpreadsheet className="size-8 text-primary" aria-hidden="true" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} ko — cliquez pour choisir un autre fichier
                </p>
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">
                  Glissez-déposez votre relevé ici, ou cliquez pour le choisir
                </p>
                <p className="text-xs text-muted-foreground">
                  Formats acceptés : CSV, Excel (.xlsx, .xlsm) — 20 Mo maximum
                </p>
              </>
            )}
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={!file || !accountId || step === 'analyzing'}
            loading={step === 'analyzing'}
          >
            Analyser le fichier
          </Button>
        </div>
      )}

      {step === 'mapping' && analysis && (
        <ColumnMappingStep
          headerRow={analysis.headerRow}
          sampleRows={sampleRows}
          mapping={mapping}
          uncertainFields={analysis.uncertainFields}
          dateOrder={dateOrder}
          decimalSeparator={decimalSeparator}
          onConfirm={handleMappingConfirm}
          onCancel={resetToDrop}
        />
      )}

      {step === 'preview' && file && fileType && analysis && (
        <ImportPreviewStep
          key={fileKey}
          initialRows={rows}
          categories={categories}
          accountId={accountId}
          accountLabel={selectedAccount?.name ?? ''}
          fileName={file.name}
          fileType={fileType}
          headerSignature={analysis.signature}
          mapping={mapping}
          dateOrder={dateOrder}
          decimalSeparator={decimalSeparator}
          rememberedProfileName={rememberedProfile?.name ?? null}
          onStartOver={resetToDrop}
        />
      )}
    </div>
  )
}
