import type { CategorizationContext, OperationToClassify } from '@/lib/banking/categorize'
import { confidenceLevel, suggestCategory } from '@/lib/banking/categorize'
import type { ColumnMapping } from '@/lib/banking/detect-columns'
import { detectColumns, headerSignature, looksLikeHeaderRow } from '@/lib/banking/detect-columns'
import type { CandidateOperation, ExistingOperation } from '@/lib/banking/duplicates'
import { checkImportBatch } from '@/lib/banking/duplicates'
import { buildFingerprint, extractMerchant, normalizeLabel } from '@/lib/banking/normalize'
import { combineDebitCredit, detectDecimalSeparator, parseBankAmount } from '@/lib/banking/parse-amount'
import { detectDateOrder, parseDate } from '@/lib/banking/parse-date'
import type { ParsedSheet } from '@/lib/banking/read-file'

/**
 * Assemblage du pipeline d'import (§9).
 *
 * Chaque brique (dates, montants, colonnes, catégorisation, doublons) est déjà
 * testée isolément. Ce module les enchaîne sans ajouter de nouvelle logique de
 * décision : il ne fait qu'orchestrer, dans l'ordre décrit au §9.
 */

export type RowStatus =
  | 'recognized' // reconnue automatiquement, haute confiance
  | 'suggested' // proposée, à confirmer
  | 'unrecognized' // non reconnue
  | 'duplicate'
  | 'similar'
  | 'invalid' // date ou montant illisible : ne peut pas être importée

export type ImportRowPreview = {
  rowIndex: number
  rawDate: string
  rawLabel: string
  rawAmount: string
  parsedDate: string | null
  parsedAmount: number | null
  normalizedLabel: string
  merchant: string
  suggestedCategoryId: string | null
  confidence: number
  categoryReason: string
  status: RowStatus
  duplicateOfId: string | null
  fingerprint: string | null
  /** Choix de l'utilisateur, modifiable dans l'aperçu (§9 étape 4). */
  selectedCategoryId: string | null
  /** Décochée par défaut sur les doublons certains ; l'utilisateur peut forcer l'import. */
  included: boolean
}

/**
 * Analyse la ligne d'en-tête et prépare la correspondance des colonnes.
 * Sépare cette étape du reste : l'utilisateur doit pouvoir la corriger avant
 * que l'aperçu ne soit calculé (§9 étape 3).
 */
export function analyzeSheet(sheet: ParsedSheet) {
  const firstRow = sheet.rows[0] ?? []
  const hasHeader = looksLikeHeaderRow(firstRow)
  const headerRow = hasHeader ? firstRow : firstRow.map((_, index) => `Colonne ${index + 1}`)
  const dataRows = hasHeader ? sheet.rows.slice(1) : sheet.rows

  const detection = detectColumns(headerRow)

  // Échantillon des 20 premières lignes pour deviner les formats : au-delà,
  // le gain de fiabilité ne justifie plus le coût de parcourir tout le fichier.
  const sample = dataRows.slice(0, 20)

  const dateColumn = detection.mapping.date
  const dateSamples =
    dateColumn !== undefined ? sample.map((row) => row[dateColumn] ?? '') : []
  const dateOrderDetection = detectDateOrder(dateSamples)

  const amountColumn = detection.mapping.amount ?? detection.mapping.debit
  const amountSamples =
    amountColumn !== undefined ? sample.map((row) => row[amountColumn] ?? '') : []
  const decimalSeparator = detectDecimalSeparator(amountSamples)

  return {
    headerRow,
    dataRows,
    hasHeader,
    mapping: detection.mapping,
    uncertainFields: detection.uncertain,
    dateOrder: dateOrderDetection.order,
    dateOrderCertain: dateOrderDetection.certain,
    decimalSeparator,
    signature: headerSignature(headerRow),
  }
}

export type BuildPreviewOptions = {
  dataRows: readonly string[][]
  mapping: ColumnMapping
  dateOrder: 'dmy' | 'mdy' | 'ymd'
  decimalSeparator: ',' | '.'
  accountId: string
  existingOperations: readonly ExistingOperation[]
  categorization: CategorizationContext
}

/**
 * Construit l'aperçu complet d'un import : une ligne par opération détectée,
 * avec date et montant analysés, catégorie proposée et statut de doublon.
 *
 * C'est la fonction centrale de l'étape 4 du §9 : « Aperçu avant validation ».
 */
export function buildImportPreview(options: BuildPreviewOptions): ImportRowPreview[] {
  const { dataRows, mapping, dateOrder, decimalSeparator, accountId, existingOperations, categorization } =
    options

  const candidates: (CandidateOperation & { rowIndex: number })[] = []
  const rawRows: {
    rowIndex: number
    rawDate: string
    rawLabel: string
    rawAmount: string
    parsedDate: string | null
    parsedAmount: number | null
    normalizedLabel: string
    merchant: string
  }[] = []

  dataRows.forEach((row, rowIndex) => {
    const rawDate = mapping.date !== undefined ? (row[mapping.date] ?? '') : ''
    const rawValueDate = mapping.valueDate !== undefined ? (row[mapping.valueDate] ?? '') : ''

    const label = mapping.label !== undefined ? (row[mapping.label] ?? '') : ''
    const description =
      mapping.description !== undefined ? (row[mapping.description] ?? '') : ''
    const rawLabel = [label, description].filter((part) => part.trim() !== '').join(' — ')

    let rawAmount: string
    let parsedAmount: number | null

    if (mapping.debit !== undefined || mapping.credit !== undefined) {
      const debit = mapping.debit !== undefined ? row[mapping.debit] : undefined
      const credit = mapping.credit !== undefined ? row[mapping.credit] : undefined
      rawAmount = [debit, credit].filter((value) => (value ?? '').trim() !== '').join(' / ')
      parsedAmount = combineDebitCredit(debit, credit, decimalSeparator)
    } else {
      rawAmount = mapping.amount !== undefined ? (row[mapping.amount] ?? '') : ''
      parsedAmount = rawAmount.trim() !== '' ? parseBankAmount(rawAmount, decimalSeparator) : null
    }

    const parsedDate = rawDate.trim() !== '' ? parseDate(rawDate, dateOrder) : null
    const normalized = normalizeLabel(rawLabel)
    const merchant = extractMerchant(normalized)

    rawRows.push({
      rowIndex,
      rawDate: rawDate || rawValueDate,
      rawLabel: rawLabel || '(libellé absent)',
      rawAmount,
      parsedDate,
      parsedAmount,
      normalizedLabel: normalized,
      merchant,
    })

    if (parsedDate && parsedAmount !== null && parsedAmount !== 0) {
      candidates.push({
        rowIndex,
        accountId,
        date: parsedDate,
        amount: parsedAmount,
        normalizedLabel: normalized,
        externalId:
          mapping.externalId !== undefined ? (row[mapping.externalId] ?? null) : null,
      })
    }
  })

  const duplicateVerdicts = checkImportBatch(candidates, existingOperations)
  const verdictByRow = new Map(duplicateVerdicts.map((verdict) => [verdict.rowIndex, verdict]))

  return rawRows.map((raw) => {
    const candidate = candidates.find((c) => c.rowIndex === raw.rowIndex)

    // Ligne inexploitable : date ou montant illisible, ou montant nul.
    if (!candidate) {
      return {
        rowIndex: raw.rowIndex,
        rawDate: raw.rawDate,
        rawLabel: raw.rawLabel,
        rawAmount: raw.rawAmount,
        parsedDate: raw.parsedDate,
        parsedAmount: raw.parsedAmount,
        normalizedLabel: raw.normalizedLabel,
        merchant: raw.merchant,
        suggestedCategoryId: null,
        confidence: 0,
        categoryReason:
          raw.parsedDate === null ? 'Date illisible' : 'Montant illisible ou nul',
        status: 'invalid' as const,
        duplicateOfId: null,
        fingerprint: null,
        selectedCategoryId: null,
        included: false,
      }
    }

    const duplicate = verdictByRow.get(raw.rowIndex)

    const suggestion = suggestCategory(
      {
        rawLabel: raw.rawLabel,
        normalizedLabel: raw.normalizedLabel,
        merchant: raw.merchant,
        amount: candidate.amount,
        accountId,
      } satisfies OperationToClassify,
      categorization,
    )

    const level = confidenceLevel(suggestion.confidence)
    const isDuplicate = duplicate?.verdict === 'duplicate'
    const isSimilar = duplicate?.verdict === 'similar'

    const status: RowStatus = isDuplicate
      ? 'duplicate'
      : isSimilar
        ? 'similar'
        : level === 'auto'
          ? 'recognized'
          : level === 'suggested'
            ? 'suggested'
            : 'unrecognized'

    return {
      rowIndex: raw.rowIndex,
      rawDate: raw.rawDate,
      rawLabel: raw.rawLabel,
      rawAmount: raw.rawAmount,
      parsedDate: raw.parsedDate,
      parsedAmount: raw.parsedAmount,
      normalizedLabel: raw.normalizedLabel,
      merchant: raw.merchant,
      suggestedCategoryId: suggestion.categoryId,
      confidence: suggestion.confidence,
      categoryReason: suggestion.reason,
      status,
      duplicateOfId: duplicate?.duplicateOfId ?? null,
      fingerprint: buildFingerprint({
        accountId,
        date: candidate.date,
        amount: candidate.amount,
        normalizedLabel: raw.normalizedLabel,
      }),
      selectedCategoryId: suggestion.categoryId,
      // Un doublon certain est décoché par défaut ; tout le reste est inclus.
      // L'utilisateur peut toujours forcer l'import d'un doublon (§11).
      included: !isDuplicate,
    }
  })
}

export type ImportRecap = {
  total: number
  nouvelles: number
  doublons: number
  aVerifier: number
  ignorees: number
}

/**
 * Regroupe le statut de chaque ligne en quatre catégories lisibles, pour le
 * récapitulatif affiché juste avant la validation finale (§9 étape 4, §11).
 *
 * Le regroupement est mutuellement exclusif : la somme des quatre nombres
 * vaut toujours le total de lignes.
 *   - nouvelles  : opération inédite, catégorie reconnue ou proposée
 *   - à vérifier : opération inédite mais sans catégorie, ou trop proche
 *                  d'une opération existante pour trancher automatiquement
 *   - doublons   : identique à une opération déjà enregistrée
 *   - ignorées   : ligne inexploitable (date ou montant illisible)
 */
export function summarizeImportRecap(rows: readonly ImportRowPreview[]): ImportRecap {
  let nouvelles = 0
  let doublons = 0
  let aVerifier = 0
  let ignorees = 0

  for (const row of rows) {
    switch (row.status) {
      case 'recognized':
      case 'suggested':
        nouvelles++
        break
      case 'unrecognized':
      case 'similar':
        aVerifier++
        break
      case 'duplicate':
        doublons++
        break
      case 'invalid':
        ignorees++
        break
    }
  }

  return { total: rows.length, nouvelles, doublons, aVerifier, ignorees }
}

export type PreviewSummary = {
  total: number
  recognized: number
  suggested: number
  unrecognized: number
  duplicates: number
  similar: number
  invalid: number
  includedCount: number
}

/** Récapitulatif chiffré affiché avant validation finale (§9 étape 4, §11). */
export function summarizePreview(rows: readonly ImportRowPreview[]): PreviewSummary {
  return {
    total: rows.length,
    recognized: rows.filter((row) => row.status === 'recognized').length,
    suggested: rows.filter((row) => row.status === 'suggested').length,
    unrecognized: rows.filter((row) => row.status === 'unrecognized').length,
    duplicates: rows.filter((row) => row.status === 'duplicate').length,
    similar: rows.filter((row) => row.status === 'similar').length,
    invalid: rows.filter((row) => row.status === 'invalid').length,
    includedCount: rows.filter((row) => row.included).length,
  }
}
