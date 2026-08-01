/**
 * Analyse des montants d'un relevé bancaire (§9 étape 2).
 *
 * Les banques n'écrivent pas les nombres de la même façon :
 *
 *   1 250,45   français, espace pour les milliers
 *   1.250,45   allemand et certains exports français
 *   1,250.45   anglo-saxon
 *   1250.45    brut, sans séparateur de milliers
 *   -89,60     signe devant
 *   89,60-     signe derrière (exports mainframe)
 *   (89,60)    parenthèses comptables pour un négatif
 *
 * Une erreur d'interprétation d'un facteur mille passe inaperçue à l'écran mais
 * fausse tous les soldes : chaque cas ci-dessus est couvert par un test.
 */

export type DecimalSeparator = ',' | '.'

/**
 * Devine le séparateur décimal d'une colonne de montants.
 *
 * Le raisonnement porte sur l'ensemble de la colonne : une valeur isolée comme
 * « 1.250 » est indécidable, alors qu'une colonne contenant aussi « 12,50 »
 * lève l'ambiguïté.
 */
export function detectDecimalSeparator(samples: readonly string[]): DecimalSeparator {
  let commaDecimal = 0
  let dotDecimal = 0

  for (const sample of samples) {
    const value = sample?.trim() ?? ''
    if (value === '') continue

    const lastComma = value.lastIndexOf(',')
    const lastDot = value.lastIndexOf('.')

    // Les deux séparateurs présents : le dernier est forcément le décimal.
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) commaDecimal++
      else dotDecimal++
      continue
    }

    // Un seul séparateur : décimal s'il reste une ou deux décimales derrière,
    // séparateur de milliers s'il en reste exactement trois.
    const separatorIndex = lastComma !== -1 ? lastComma : lastDot
    if (separatorIndex === -1) continue

    const decimals = value.length - separatorIndex - 1
    if (decimals === 1 || decimals === 2) {
      if (lastComma !== -1) commaDecimal++
      else dotDecimal++
    }
  }

  // À égalité ou sans indice, la virgule l'emporte : le public visé est français.
  return dotDecimal > commaDecimal ? '.' : ','
}

/**
 * Convertit une valeur de relevé en nombre.
 *
 * @param raw Valeur brute de la cellule.
 * @param decimalSeparator Séparateur décimal de la colonne, si connu.
 * @returns Le montant, ou null si la valeur n'est pas un nombre.
 */
export function parseBankAmount(
  raw: string,
  decimalSeparator: DecimalSeparator = ',',
): number | null {
  let value = raw?.trim() ?? ''
  if (value === '') return null

  let negative = false

  // Parenthèses comptables : (89,60) vaut -89,60.
  if (/^\(.*\)$/.test(value)) {
    negative = true
    value = value.slice(1, -1).trim()
  }

  // Signe placé après le nombre, courant sur les exports de gros systèmes.
  if (value.endsWith('-')) {
    negative = true
    value = value.slice(0, -1).trim()
  }
  if (value.startsWith('-')) {
    negative = true
    value = value.slice(1).trim()
  }
  if (value.startsWith('+')) {
    value = value.slice(1).trim()
  }

  // Symboles monétaires, codes devise et espaces (y compris insécables).
  value = value
    .replace(/[€$£]/g, '')
    .replace(/\b(EUR|USD|GBP|CHF|CAD)\b/gi, '')
    .replace(/\s/g, '')
    .trim()

  if (value === '') return null

  // Retrait du séparateur de milliers, puis normalisation du séparateur décimal.
  if (decimalSeparator === ',') {
    value = value.replace(/\./g, '').replace(',', '.')
  } else {
    value = value.replace(/,/g, '')
  }

  // À ce stade, seuls des chiffres et un point décimal doivent subsister.
  if (!/^\d*\.?\d*$/.test(value) || value === '.' || value === '') return null

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null

  // Arrondi au centime : une cellule Excel peut porter des décimales parasites
  // issues du binaire flottant.
  const rounded = Math.round(parsed * 100) / 100
  return negative ? -rounded : rounded
}

/**
 * Combine deux colonnes Débit et Crédit en un montant signé.
 *
 * De nombreux relevés français présentent deux colonnes distinctes, toutes deux
 * en valeurs positives. La convention de l'application est un montant signé :
 * le débit devient négatif, le crédit reste positif.
 */
export function combineDebitCredit(
  debit: string | null | undefined,
  credit: string | null | undefined,
  decimalSeparator: DecimalSeparator = ',',
): number | null {
  const debitValue = debit ? parseBankAmount(debit, decimalSeparator) : null
  const creditValue = credit ? parseBankAmount(credit, decimalSeparator) : null

  // Une seule des deux colonnes est renseignée sur une ligne donnée.
  if (debitValue !== null && debitValue !== 0) {
    // La colonne Débit contient parfois déjà un signe négatif : on ne le double pas.
    return debitValue > 0 ? -debitValue : debitValue
  }
  if (creditValue !== null && creditValue !== 0) {
    return Math.abs(creditValue)
  }

  return null
}
