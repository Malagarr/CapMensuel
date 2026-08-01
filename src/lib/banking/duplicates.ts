import { buildFingerprint } from '@/lib/banking/normalize'

/**
 * Détection des doublons (§11).
 *
 * Deux sources de doublons se cumulent :
 *
 *   - le fichier importé recoupe des opérations déjà enregistrées, parce que
 *     l'utilisateur réimporte un relevé qui chevauche le précédent ;
 *   - le fichier contient lui-même deux fois la même ligne.
 *
 * Aucun doublon n'est jamais écarté silencieusement : il est signalé, et
 * l'utilisateur peut forcer son import (§11).
 */

export type DuplicateVerdict = 'new' | 'duplicate' | 'similar'

export type ExistingOperation = {
  id: string
  accountId: string
  date: string
  amount: number
  normalizedLabel: string
  externalId: string | null
}

export type CandidateOperation = {
  accountId: string
  date: string
  amount: number
  normalizedLabel: string
  externalId: string | null
}

export type DuplicateCheck = {
  verdict: DuplicateVerdict
  /** Identifiant de l'opération existante en cause, si connue. */
  duplicateOfId: string | null
  reason: string
}

/**
 * Tolérance de date pour les opérations « proches ».
 *
 * Une même dépense peut être datée du jour de l'achat sur un export et du jour
 * de comptabilisation sur un autre : trois jours d'écart restent plausibles.
 */
const SIMILAR_DAY_TOLERANCE = 3

/** Écart en jours entre deux dates ISO. */
function dayGap(a: string, b: string): number {
  const dateA = Date.parse(`${a}T00:00:00Z`)
  const dateB = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(dateA) || Number.isNaN(dateB)) return Number.POSITIVE_INFINITY
  return Math.abs(dateA - dateB) / 86_400_000
}

/** Compare deux montants au centime près, sans piège de binaire flottant. */
function sameAmount(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100)
}

/**
 * Confronte une ligne candidate aux opérations déjà enregistrées.
 */
export function checkDuplicate(
  candidate: CandidateOperation,
  existing: readonly ExistingOperation[],
): DuplicateCheck {
  // 1. Identifiant fourni par la banque : la preuve la plus solide.
  if (candidate.externalId) {
    const byExternalId = existing.find(
      (operation) =>
        operation.externalId !== null &&
        operation.externalId === candidate.externalId &&
        operation.accountId === candidate.accountId,
    )
    if (byExternalId) {
      return {
        verdict: 'duplicate',
        duplicateOfId: byExternalId.id,
        reason: 'Même référence bancaire qu’une opération déjà enregistrée',
      }
    }
  }

  // 2. Empreinte exacte : compte, date, montant et libellé normalisé.
  const candidateFingerprint = buildFingerprint({
    accountId: candidate.accountId,
    date: candidate.date,
    amount: candidate.amount,
    normalizedLabel: candidate.normalizedLabel,
  })

  const byFingerprint = existing.find(
    (operation) =>
      buildFingerprint({
        accountId: operation.accountId,
        date: operation.date,
        amount: operation.amount,
        normalizedLabel: operation.normalizedLabel,
      }) === candidateFingerprint,
  )

  if (byFingerprint) {
    return {
      verdict: 'duplicate',
      duplicateOfId: byFingerprint.id,
      reason: 'Opération identique déjà enregistrée',
    }
  }

  // 3. Opération proche : même compte, même montant, même libellé, à quelques
  //    jours près. Signalée pour vérification, jamais écartée d'office.
  const similar = existing.find(
    (operation) =>
      operation.accountId === candidate.accountId &&
      sameAmount(operation.amount, candidate.amount) &&
      operation.normalizedLabel === candidate.normalizedLabel &&
      operation.normalizedLabel !== '' &&
      dayGap(operation.date, candidate.date) <= SIMILAR_DAY_TOLERANCE,
  )

  if (similar) {
    return {
      verdict: 'similar',
      duplicateOfId: similar.id,
      reason: `Opération très proche du ${similar.date}, à vérifier`,
    }
  }

  return { verdict: 'new', duplicateOfId: null, reason: 'Nouvelle opération' }
}

export type RowVerdict = DuplicateCheck & { rowIndex: number }

/**
 * Analyse un fichier entier.
 *
 * Les lignes déjà vues dans le fichier lui-même sont marquées comme doublons :
 * un export bancaire peut contenir deux fois la même écriture.
 */
export function checkImportBatch(
  candidates: readonly CandidateOperation[],
  existing: readonly ExistingOperation[],
): RowVerdict[] {
  const results: RowVerdict[] = []
  const seenInFile = new Map<string, number>()

  candidates.forEach((candidate, rowIndex) => {
    const fingerprint = buildFingerprint({
      accountId: candidate.accountId,
      date: candidate.date,
      amount: candidate.amount,
      normalizedLabel: candidate.normalizedLabel,
    })

    const firstOccurrence = seenInFile.get(fingerprint)
    if (firstOccurrence !== undefined) {
      results.push({
        rowIndex,
        verdict: 'duplicate',
        duplicateOfId: null,
        reason: `Ligne identique à la ligne ${firstOccurrence + 1} du même fichier`,
      })
      return
    }

    seenInFile.set(fingerprint, rowIndex)
    results.push({ rowIndex, ...checkDuplicate(candidate, existing) })
  })

  return results
}

export type ImportSummary = {
  total: number
  newRows: number
  duplicates: number
  toReview: number
  ignored: number
}

/** Récapitulatif affiché avant validation (§11). */
export function summarize(
  verdicts: readonly DuplicateVerdict[],
  ignoredCount = 0,
): ImportSummary {
  return {
    total: verdicts.length + ignoredCount,
    newRows: verdicts.filter((verdict) => verdict === 'new').length,
    duplicates: verdicts.filter((verdict) => verdict === 'duplicate').length,
    toReview: verdicts.filter((verdict) => verdict === 'similar').length,
    ignored: ignoredCount,
  }
}
