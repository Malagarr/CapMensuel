'use client'

import { useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Field, Select } from '@/components/ui/field'
import {
  columnFieldLabels,
  type ColumnField,
  type ColumnMapping,
} from '@/lib/banking/detect-columns'
import type { DateOrder } from '@/lib/banking/parse-date'
import type { DecimalSeparator } from '@/lib/banking/parse-amount'

/** Ordre d'affichage des champs à faire correspondre (§9 étape 3). */
const FIELD_ORDER: ColumnField[] = [
  'date',
  'valueDate',
  'label',
  'description',
  'debit',
  'credit',
  'amount',
  'currency',
  'externalId',
]

const NONE = '__aucune__'

export function ColumnMappingStep({
  headerRow,
  sampleRows,
  mapping,
  uncertainFields,
  dateOrder,
  decimalSeparator,
  onConfirm,
  onCancel,
}: {
  headerRow: string[]
  sampleRows: string[][]
  mapping: ColumnMapping
  uncertainFields: ColumnField[]
  dateOrder: DateOrder
  decimalSeparator: DecimalSeparator
  onConfirm: (
    mapping: ColumnMapping,
    dateOrder: DateOrder,
    decimalSeparator: DecimalSeparator,
  ) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ColumnMapping>(mapping)
  const [draftDateOrder, setDraftDateOrder] = useState<DateOrder>(dateOrder)
  const [draftDecimalSeparator, setDraftDecimalSeparator] =
    useState<DecimalSeparator>(decimalSeparator)
  const [validationError, setValidationError] = useState<string | null>(null)

  function setField(field: ColumnField, value: string) {
    setDraft((current) => {
      const next = { ...current }
      if (value === NONE) {
        delete next[field]
      } else {
        next[field] = Number(value)
      }
      return next
    })
  }

  function handleConfirm() {
    if (draft.date === undefined) {
      setValidationError('La colonne date de l’opération est indispensable.')
      return
    }
    if (draft.label === undefined) {
      setValidationError('La colonne libellé est indispensable.')
      return
    }
    if (draft.amount === undefined && (draft.debit === undefined || draft.credit === undefined)) {
      setValidationError(
        'Indiquez soit une colonne « Montant signé », soit les deux colonnes « Débit » et « Crédit ».',
      )
      return
    }
    setValidationError(null)
    onConfirm(draft, draftDateOrder, draftDecimalSeparator)
  }

  return (
    <Card>
      <CardHeader
        title="Faites correspondre les colonnes"
        description="La détection automatique n’est pas certaine pour tous les champs : vérifiez et corrigez au besoin."
      />
      <CardBody className="space-y-5">
        {validationError && <Alert tone="danger">{validationError}</Alert>}

        {sampleRows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  {headerRow.map((header, index) => (
                    <th key={index} className="whitespace-nowrap px-2.5 py-1.5 text-left font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sampleRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="whitespace-nowrap px-2.5 py-1.5 text-muted-foreground">
                        {cell || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {FIELD_ORDER.map((field) => {
            const isUncertain = uncertainFields.includes(field)
            const isRequired = field === 'date' || field === 'label'
            return (
              <Field
                key={field}
                label={columnFieldLabels[field]}
                htmlFor={`mapping-${field}`}
                required={isRequired}
                hint={isUncertain ? 'Détection incertaine : merci de vérifier.' : undefined}
              >
                <Select
                  id={`mapping-${field}`}
                  value={draft[field] !== undefined ? String(draft[field]) : NONE}
                  onChange={(event) => setField(field, event.target.value)}
                  invalid={isUncertain}
                >
                  <option value={NONE}>— Aucune colonne —</option>
                  {headerRow.map((header, index) => (
                    <option key={index} value={index}>
                      {header || `Colonne ${index + 1}`}
                    </option>
                  ))}
                </Select>
              </Field>
            )
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ordre des dates" htmlFor="mapping-date-order">
            <Select
              id="mapping-date-order"
              value={draftDateOrder}
              onChange={(event) => setDraftDateOrder(event.target.value as DateOrder)}
            >
              <option value="dmy">Jour / mois / année (français)</option>
              <option value="mdy">Mois / jour / année (américain)</option>
              <option value="ymd">Année / mois / jour</option>
            </Select>
          </Field>

          <Field label="Séparateur décimal" htmlFor="mapping-decimal">
            <Select
              id="mapping-decimal"
              value={draftDecimalSeparator}
              onChange={(event) => setDraftDecimalSeparator(event.target.value as DecimalSeparator)}
            >
              <option value=",">Virgule — 1 250,45</option>
              <option value=".">Point — 1,250.45</option>
            </Select>
          </Field>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleConfirm}>Valider la correspondance</Button>
          <Button variant="ghost" onClick={onCancel}>
            Recommencer
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
