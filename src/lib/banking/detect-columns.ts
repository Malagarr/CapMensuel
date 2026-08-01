import { deburrLower } from '@/lib/banking/normalize'

/**
 * Détection automatique des colonnes d'un relevé (§9 étape 2).
 *
 * Chaque banque nomme ses colonnes différemment : « Date opération », « Date de
 * comptabilisation », « Libellé simplifié », « Nature de l'opération »…
 * On associe chaque en-tête au champ dont il partage le plus de vocabulaire,
 * et l'utilisateur peut toujours corriger (§9 étape 3).
 */

export type ColumnField =
  | 'date'
  | 'valueDate'
  | 'label'
  | 'description'
  | 'debit'
  | 'credit'
  | 'amount'
  | 'currency'
  | 'externalId'

/** Correspondance champ -> index de colonne dans le fichier. */
export type ColumnMapping = Partial<Record<ColumnField, number>>

export const columnFieldLabels: Record<ColumnField, string> = {
  date: 'Date de l’opération',
  valueDate: 'Date de valeur',
  label: 'Libellé',
  description: 'Description complémentaire',
  debit: 'Débit (dépense)',
  credit: 'Crédit (revenu)',
  amount: 'Montant signé',
  currency: 'Devise',
  externalId: 'Référence bancaire',
}

/**
 * Mots-clés par champ, du plus spécifique au plus général.
 *
 * L'ordre compte : « date de valeur » doit être testé avant « date », sinon
 * toute colonne contenant « date » serait prise pour la date d'opération.
 */
const FIELD_KEYWORDS: { field: ColumnField; keywords: string[]; score: number }[] = [
  // Date de valeur — testée en premier, plus spécifique que « date ».
  { field: 'valueDate', keywords: ['date de valeur', 'date valeur', 'value date'], score: 100 },

  // Date d'opération.
  {
    field: 'date',
    keywords: [
      'date operation',
      'date de operation',
      'date de comptabilisation',
      'date comptable',
      'date achat',
      'transaction date',
      'booking date',
      'date',
    ],
    score: 90,
  },

  // Débit et crédit, avant « montant » car plus spécifiques.
  {
    field: 'debit',
    keywords: ['debit', 'depense', 'retrait', 'sortie', 'withdrawal', 'sorties'],
    score: 95,
  },
  {
    field: 'credit',
    keywords: ['credit', 'recette', 'depot', 'entree', 'deposit', 'entrees'],
    score: 95,
  },

  // Montant signé.
  {
    field: 'amount',
    keywords: ['montant', 'amount', 'somme', 'valeur', 'solde operation'],
    score: 85,
  },

  // Libellé.
  {
    field: 'label',
    keywords: [
      'libelle simplifie',
      'libelle',
      'intitule',
      'nature de la operation',
      'nature',
      'motif',
      'description',
      'designation',
      'objet',
      'wording',
      'details',
    ],
    score: 80,
  },

  // Informations complémentaires.
  {
    field: 'description',
    keywords: ['informations complementaires', 'commentaire', 'note', 'reference client'],
    score: 70,
  },

  { field: 'currency', keywords: ['devise', 'currency', 'monnaie'], score: 90 },

  {
    field: 'externalId',
    keywords: ['reference', 'numero de operation', 'identifiant', 'id operation'],
    score: 75,
  },
]

/** Nettoie un en-tête pour la comparaison. */
function normalizeHeader(header: string): string {
  return deburrLower(header)
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Score d'un en-tête pour un champ donné, 0 si aucune correspondance. */
function scoreHeader(header: string, keywords: string[], baseScore: number): number {
  const normalized = normalizeHeader(header)
  if (normalized === '') return 0

  for (const keyword of keywords) {
    // Correspondance exacte : la plus fiable.
    if (normalized === keyword) return baseScore + 20
    // L'en-tête contient le mot-clé.
    if (normalized.includes(keyword)) {
      // Un mot-clé long emporte davantage la décision qu'un mot-clé court.
      return baseScore + Math.min(keyword.length, 15)
    }
  }

  return 0
}

export type DetectionResult = {
  mapping: ColumnMapping
  /** Champs dont la détection est incertaine, à faire confirmer. */
  uncertain: ColumnField[]
  /** Vrai si la première ligne semble être un en-tête et non une opération. */
  hasHeaderRow: boolean
}

/**
 * Vérifie si une ligne ressemble à un en-tête.
 *
 * Une ligne d'en-tête ne contient pas de date ni de montant : elle est faite de
 * mots. Sans cette vérification, un fichier sans en-tête verrait sa première
 * opération avalée comme titre de colonnes.
 */
export function looksLikeHeaderRow(row: readonly string[]): boolean {
  const cells = row.filter((cell) => (cell ?? '').trim() !== '')
  if (cells.length === 0) return false

  const numericCells = cells.filter((cell) =>
    /^[\s\-+(]*[\d\s.,]+[)\s€$£]*$/.test(cell.trim()),
  ).length

  const dateCells = cells.filter((cell) =>
    /^\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}/.test(cell.trim()),
  ).length

  // Un en-tête est majoritairement textuel.
  return numericCells + dateCells === 0
}

/**
 * Associe les en-têtes du fichier aux champs de l'application.
 *
 * @param headers Cellules de la ligne d'en-tête.
 */
export function detectColumns(headers: readonly string[]): DetectionResult {
  const mapping: ColumnMapping = {}
  const bestScores = new Map<ColumnField, number>()
  const usedColumns = new Set<number>()

  // Chaque champ retient la colonne qui obtient le meilleur score.
  for (const { field, keywords, score } of FIELD_KEYWORDS) {
    let bestIndex = -1
    let bestScore = 0

    headers.forEach((header, index) => {
      if (usedColumns.has(index)) return

      const headerScore = scoreHeader(header ?? '', keywords, score)
      if (headerScore > bestScore) {
        bestScore = headerScore
        bestIndex = index
      }
    })

    if (bestIndex !== -1) {
      mapping[field] = bestIndex
      bestScores.set(field, bestScore)
      usedColumns.add(bestIndex)
    }
  }

  // Un fichier a soit un montant signé, soit deux colonnes débit/crédit.
  // Détecter les trois est le signe d'une confusion : on garde débit/crédit,
  // plus explicite, et on signale le montant comme incertain.
  const uncertain: ColumnField[] = []

  if (mapping.amount !== undefined && mapping.debit !== undefined && mapping.credit !== undefined) {
    uncertain.push('amount')
  }

  // Les champs indispensables manquants doivent être confirmés par l'utilisateur.
  if (mapping.date === undefined) uncertain.push('date')
  if (mapping.label === undefined) uncertain.push('label')
  if (mapping.amount === undefined && (mapping.debit === undefined || mapping.credit === undefined)) {
    uncertain.push('amount')
  }

  // Une correspondance obtenue de justesse mérite aussi confirmation.
  for (const [field, score] of bestScores) {
    if (score < 90 && !uncertain.includes(field)) {
      uncertain.push(field)
    }
  }

  return {
    mapping,
    uncertain,
    hasHeaderRow: looksLikeHeaderRow(headers),
  }
}

/**
 * Empreinte de la structure du fichier.
 *
 * Sert à retrouver le profil d'import déjà enregistré pour une banque (§9
 * étape 3, « mémoriser le format du fichier »).
 */
export function headerSignature(headers: readonly string[]): string {
  return headers
    .map((header) => normalizeHeader(header ?? ''))
    .filter((header) => header !== '')
    .join('|')
}
