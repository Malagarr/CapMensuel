'use client'

import { useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Field, Select } from '@/components/ui/field'
import type { ColumnMapping } from '@/lib/banking/detect-columns'
import type { analyzeSheet } from '@/lib/banking/import-pipeline'
import type { DateOrder } from '@/lib/banking/parse-date'
import type { DecimalSeparator } from '@/lib/banking/parse-amount'

type SheetAnalysis = ReturnType<typeof analyzeSheet>

const NONE = '__none__'

/**
 * Correspondance manuelle des colonnes (§9 étape 3).
 *
 * N'apparaît que lorsque la détection automatique n'est pas certaine. La
 * détection reste appliquée par défaut : l'utilisateur corrige, il ne repart
 * pas de zéro.
 */
export function MappingStep({
  analysis,
  onConfirm,
  onCancel,
}: {
  analysis: SheetAnalysis
  onConfirm: (mapping: ColumnMapping, dateOrder: DateOrder, decimalSeparator: DecimalSeparator) => void
  onCancel: () => void
}) {
  const [dateCol, setDateCol] = useState(analysis.mapping.date)
  const [labelCol, setLabelCol] = useState(analysis.mapping.label)
  const [useDebitCredit, setUseDebitCredit] = useState(
    analysis.mapping.debit !== undefined || analysis.mapping.credit !== undefined,
  )
  const [amountCol, setAmountCol] = useState(analysis.mapping.amount)
  const [debitCol, setDebitCol] = useState(analysis.mapping.debit)
  const [creditCol, setCreditCol] = useState(analysis.mapping.credit)
  const [dateOrder, setDateOrder] = useState<DateOrder>(analysis.dateOrder)
  const [decimalSeparator, setDecimalSeparator] = useState<DecimalSeparator>(
    analysis.decimalSeparator,
  )

  const columnOptions = analysis.headerRow.map((header, index) => ({ index, header }))

  const canConfirm =
    dateCol !== undefined && labelCol !== undefined && (useDebitCredit ? debitCol !== undefined || creditCol !== undefined : amountCol !== undefined)

  function handleConfirm() {
    if (!canConfirm) return

    const mapping: ColumnMapping = { date: dateCol, label: labelCol }
    if (useDebitCredit) {
      if (debitCol !== undefined) mapping.debit = debitCol
      if (creditCol !== undefined) mapping.credit = creditCol
    } else if (amountCol !== undefined) {
      mapping.amount = amountCol
    }

    onConfirm(mapping, dateOrder, decimalSeparator)
  }

  return (
    <Card>
      <CardHeader
        title="Faites correspondre les colonnes"
        description="La détection automatique n’était pas certaine pour ce fichier. Vérifiez ou corrigez les colonnes ci-dessous."
      />
      <CardBody className="space-y-4 pt-3">
        <Alert tone="info">
          Ce format sera mémorisé : les prochains fichiers de cette même banque seront
          reconnus automatiquement.
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          <ColumnSelect
            label="Colonne « Date »"
            value={dateCol}
            onChange={setDateCol}
            options={columnOptions}
          />
          <ColumnSelect
            label="Colonne « Libellé »"
            value={labelCol}
            onChange={setLabelCol}
            options={columnOptions}
          />
        </div>

        <Field label="Format de date" htmlFor="date-order">
          <Select
            id="date-order"
            value={dateOrder}
            onChange={(event) => setDateOrder(event.target.value as DateOrder)}
          >
            <option value="dmy">Jour / Mois / Année (12/07/2026)</option>
            <option value="mdy">Mois / Jour / Année (07/12/2026)</option>
            <option value="ymd">Année / Mois / Jour (2026-07-12)</option>
          </Select>
        </Field>

        <fieldset className="space-y-3 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium">Montants</legend>

          <div role="radiogroup" aria-label="Disposition des montants" className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!useDebitCredit}
                onChange={() => setUseDebitCredit(false)}
                className="size-4"
              />
              Une seule colonne, montant signé
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={useDebitCredit}
                onChange={() => setUseDebitCredit(true)}
                className="size-4"
              />
              Deux colonnes, Débit et Crédit
            </label>
          </div>

          {useDebitCredit ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <ColumnSelect
                label="Colonne « Débit »"
                value={debitCol}
                onChange={setDebitCol}
                options={columnOptions}
                allowNone
              />
              <ColumnSelect
                label="Colonne « Crédit »"
                value={creditCol}
                onChange={setCreditCol}
                options={columnOptions}
                allowNone
              />
            </div>
          ) : (
            <ColumnSelect
              label="Colonne « Montant »"
              value={amountCol}
              onChange={setAmountCol}
              options={columnOptions}
            />
          )}

          <Field label="Séparateur décimal" htmlFor="decimal-separator">
            <Select
              id="decimal-separator"
              value={decimalSeparator}
              onChange={(event) => setDecimalSeparator(event.target.value as DecimalSeparator)}
            >
              <option value=",">Virgule (1 250,45)</option>
              <option value=".">Point (1250.45)</option>
            </Select>
          </Field>
        </fieldset>

        <div className="flex gap-2">
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Continuer
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Choisir un autre fichier
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function ColumnSelect({
  label,
  value,
  onChange,
  options,
  allowNone = false,
}: {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  options: { index: number; header: string }[]
  allowNone?: boolean
}) {
  const id = `col-${label.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <Field label={label} htmlFor={id}>
      <Select
        id={id}
        value={value === undefined ? NONE : String(value)}
        onChange={(event) =>
          onChange(event.target.value === NONE ? undefined : Number(event.target.value))
        }
      >
        {allowNone && <option value={NONE}>Aucune</option>}
        {!allowNone && value === undefined && <option value={NONE}>Choisir…</option>}
        {options.map((option) => (
          <option key={option.index} value={option.index}>
            {option.header || `Colonne ${option.index + 1}`}
          </option>
        ))}
      </Select>
    </Field>
  )
}
