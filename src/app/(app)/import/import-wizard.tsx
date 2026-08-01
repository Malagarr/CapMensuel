'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'

import { MappingStep } from '@/app/(app)/import/mapping-step'
import { PreviewStep } from '@/app/(app)/import/preview-step'
import { loadImportContextAction, findImportProfileAction, type ImportContext } from '@/lib/actions/import'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Field, Select } from '@/components/ui/field'
import { analyzeSheet } from '@/lib/banking/import-pipeline'
import { detectFileType, readBankFile, type SupportedFileType } from '@/lib/banking/read-file'
import { cn } from '@/lib/utils'

export type AccountOption = { id: string; name: string; currency: string }

type SheetAnalysis = ReturnType<typeof analyzeSheet>

type WizardState =
  | { step: 'drop' }
  | { step: 'reading' }
  | {
      step: 'mapping'
      fileName: string
      fileType: SupportedFileType
      analysis: SheetAnalysis
      context: ImportContext
    }
  | {
      step: 'preview'
      fileName: string
      fileType: SupportedFileType
      analysis: SheetAnalysis
      context: ImportContext
    }

export function ImportWizard({ accounts }: { accounts: AccountOption[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [state, setState] = useState<WizardState>({ step: 'drop' })
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const account = useMemo(() => accounts.find((a) => a.id === accountId), [accounts, accountId])

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      const type = detectFileType(file.name)
      if (!type) {
        setError(
          'Format non pris en charge. Utilisez un fichier .csv ou .xlsx. Un ancien ' +
            'fichier .xls doit d’abord être réenregistré en .xlsx.',
        )
        return
      }

      setState({ step: 'reading' })

      const [fileResult, context] = await Promise.all([
        readBankFile(file),
        loadImportContextAction(accountId),
      ])

      if (!fileResult.success) {
        setError(fileResult.error.message)
        setState({ step: 'drop' })
        return
      }

      const analysis = analyzeSheet(fileResult.sheet)

      // Format déjà connu pour cette banque (§9 étape 3) : on applique la
      // correspondance mémorisée et on saute directement à l'aperçu.
      const remembered = await findImportProfileAction(analysis.signature)

      const finalAnalysis: SheetAnalysis = remembered
        ? {
            ...analysis,
            mapping: remembered.mapping,
            dateOrder: remembered.dateFormat,
            dateOrderCertain: true,
            decimalSeparator: remembered.decimalSeparator,
            uncertainFields: [],
          }
        : analysis

      setState({
        step: remembered || finalAnalysis.uncertainFields.length === 0 ? 'preview' : 'mapping',
        fileName: file.name,
        fileType: type,
        analysis: finalAnalysis,
        context,
      })
    },
    [accountId],
  )

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  function reset() {
    setState({ step: 'drop' })
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  if (state.step === 'mapping') {
    return (
      <MappingStep
        analysis={state.analysis}
        onConfirm={(mapping, dateOrder, decimalSeparator) =>
          setState({
            ...state,
            step: 'preview',
            analysis: { ...state.analysis, mapping, dateOrder, decimalSeparator },
          })
        }
        onCancel={reset}
      />
    )
  }

  if (state.step === 'preview') {
    return (
      <PreviewStep
        fileName={state.fileName}
        fileType={state.fileType}
        analysis={state.analysis}
        context={state.context}
        accountId={accountId}
        currency={account?.currency ?? 'EUR'}
        onRestart={reset}
      />
    )
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Compte concerné" htmlFor="import-account" required>
          <Select
            id="import-account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            disabled={state.step === 'reading'}
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </Select>
        </Field>

        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center justify-center rounded-app border-2 border-dashed p-10 text-center transition-colors',
            dragOver ? 'border-ring bg-primary-soft/40' : 'border-border',
          )}
        >
          {state.step === 'reading' ? (
            <>
              <span
                className="mb-3 flex size-12 animate-pulse items-center justify-center rounded-2xl bg-primary-soft text-primary"
                aria-hidden="true"
              >
                <FileSpreadsheet className="size-6" />
              </span>
              <p className="font-medium">Analyse du fichier…</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tout se passe dans votre navigateur.
              </p>
            </>
          ) : (
            <>
              <span
                className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
                aria-hidden="true"
              >
                <Upload className="size-6" />
              </span>
              <p className="font-medium">Glissez votre relevé ici</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Fichiers .csv ou .xlsx, jusqu’à 20 Mo
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => inputRef.current?.click()}
              >
                Choisir un fichier
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xlsm"
                className="sr-only"
                aria-label="Sélectionner un fichier de relevé bancaire"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleFile(file)
                }}
              />
            </>
          )}
        </div>

        {account && (
          <p className="text-xs text-muted-foreground">
            Les opérations seront rattachées au compte « {account.name} ».
          </p>
        )}
      </CardBody>
    </Card>
  )
}
