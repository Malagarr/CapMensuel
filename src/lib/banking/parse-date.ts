/**
 * Analyse des dates d'un relevé bancaire (§9 étape 2).
 *
 * Le piège central est l'ambiguïté entre jour/mois et mois/jour : « 03/04/2026 »
 * est le 3 avril pour une banque française, le 4 mars pour une banque
 * américaine. Aucune ligne prise isolément ne permet de trancher.
 *
 * La stratégie est donc d'observer TOUTE la colonne avant de décider : dès
 * qu'une valeur porte un premier nombre supérieur à 12, l'ordre est
 * nécessairement jour/mois. À défaut d'indice, on retient le format français,
 * conforme au public visé.
 */

export type DateOrder = 'dmy' | 'mdy' | 'ymd'

export type DateFormatDetection = {
  order: DateOrder
  /** Vrai si l'ordre a été prouvé par les données, faux s'il s'agit du défaut. */
  certain: boolean
  /** Nombre de valeurs de l'échantillon qui n'ont pas pu être analysées. */
  unparsed: number
}

/** Sépare une date en trois nombres, quel que soit le séparateur. */
function splitParts(raw: string): number[] | null {
  const cleaned = raw.trim()
  if (cleaned === '') return null

  const match = /^(\d{1,4})[/.\- ](\d{1,2})[/.\- ](\d{1,4})$/.exec(cleaned)
  if (!match) return null

  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/**
 * Convertit un numéro de série Excel en date ISO.
 *
 * Excel compte les jours depuis le 30 décembre 1899 : le décalage tient compte
 * du 29 février 1900 inexistant, bug historique conservé par compatibilité.
 */
export function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0 || serial > 100_000) return null

  const epoch = Date.UTC(1899, 11, 30)
  const date = new Date(epoch + Math.round(serial) * 86_400_000)
  if (Number.isNaN(date.getTime())) return null

  return date.toISOString().slice(0, 10)
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false
  if (day < 1) return false

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day <= lastDay
}

/** Complète une année à deux chiffres : 26 -> 2026, 98 -> 1998. */
function expandYear(year: number): number {
  if (year >= 100) return year
  return year <= 69 ? 2000 + year : 1900 + year
}

/**
 * Détermine l'ordre des composantes en observant un échantillon de valeurs.
 */
export function detectDateOrder(samples: readonly string[]): DateFormatDetection {
  let dayFirstProof = 0
  let monthFirstProof = 0
  let yearFirstProof = 0
  let unparsed = 0

  for (const sample of samples) {
    const parts = splitParts(sample)
    if (!parts) {
      if (sample.trim() !== '') unparsed++
      continue
    }

    const [first, second, third] = parts as [number, number, number]

    // Une première composante à quatre chiffres ne peut être qu'une année.
    if (first > 31) {
      yearFirstProof++
      continue
    }

    // Preuve directe : un nombre supérieur à 12 ne peut pas être un mois.
    if (first > 12) dayFirstProof++
    if (second > 12) monthFirstProof++

    // Une troisième composante à quatre chiffres confirme l'année en dernier,
    // sans départager jour/mois.
    void third
  }

  if (yearFirstProof > 0 && dayFirstProof === 0) {
    return { order: 'ymd', certain: true, unparsed }
  }
  if (dayFirstProof > 0 && monthFirstProof === 0) {
    return { order: 'dmy', certain: true, unparsed }
  }
  if (monthFirstProof > 0 && dayFirstProof === 0) {
    return { order: 'mdy', certain: true, unparsed }
  }

  // Aucune preuve, ou preuves contradictoires : format français par défaut.
  return { order: 'dmy', certain: false, unparsed }
}

/**
 * Analyse une date selon un ordre connu.
 *
 * @returns La date au format AAAA-MM-JJ, ou null si la valeur est inexploitable.
 */
export function parseDate(raw: string, order: DateOrder = 'dmy'): string | null {
  const trimmed = raw?.trim() ?? ''
  if (trimmed === '') return null

  // Format ISO complet, éventuellement suivi d'une heure.
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Number(isoMatch[2])
    const day = Number(isoMatch[3])
    return isValidDate(year, month, day)
      ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
      : null
  }

  // Numéro de série Excel : une colonne de dates mal typée arrive en nombre.
  if (/^\d+([.,]\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed.replace(',', '.'))
    // Un nombre à moins de 5 chiffres n'est pas une date plausible.
    return serial >= 10_000 ? excelSerialToIso(serial) : null
  }

  const parts = splitParts(trimmed)
  if (!parts) return null

  const [first, second, third] = parts as [number, number, number]

  let year: number
  let month: number
  let day: number

  if (first > 31 || order === 'ymd') {
    year = expandYear(first)
    month = second
    day = third
  } else if (order === 'mdy') {
    month = first
    day = second
    year = expandYear(third)
  } else {
    day = first
    month = second
    year = expandYear(third)
  }

  if (!isValidDate(year, month, day)) return null

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
