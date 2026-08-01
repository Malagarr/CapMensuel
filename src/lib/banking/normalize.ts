/**
 * Normalisation des libellés bancaires (§27).
 *
 * Un relevé bancaire écrit la même enseigne de dix façons différentes :
 *
 *   « CB 2507 INTERMARCHE LESNEVEN 29 CARTE 1234 »
 *   « PAIEMENT CB 12/07 INTERMARCHE LESNEVEN »
 *   « ACHAT CB INTERMARCHE LESNEVEN 29260 »
 *
 * Ces trois lignes doivent produire la même forme normalisée, sinon la
 * catégorisation automatique et la détection de doublons ne fonctionnent pas.
 *
 * Le libellé d'origine est TOUJOURS conservé à côté : c'est lui qui fait foi
 * pour l'utilisateur, la forme normalisée n'est qu'un outil interne.
 */

/**
 * Préfixes de type d'opération, retirés en tête de libellé.
 * L'ordre compte : les plus longs d'abord, sinon « CB » mangerait « CB DU ».
 */
const OPERATION_PREFIXES = [
  'paiement par carte',
  'paiement carte',
  'achat carte',
  'retrait carte',
  'paiement cb',
  'achat cb',
  'retrait cb',
  'facture carte',
  'prelevement europeen',
  'prelevement sepa',
  'prelevement',
  'prlv sepa',
  'prlv',
  'virement instantane',
  'virement sepa',
  'virement recu',
  'virement emis',
  'virement',
  'vir inst',
  'vir sepa',
  'vir',
  'remise cheque',
  'cheque',
  'chq',
  'carte',
  'cb',
  'ecom',
  'sepa',
]

/** Mots techniques sans valeur pour identifier un commerçant. */
const NOISE_WORDS = new Set([
  'du',
  'le',
  'la',
  'les',
  'de',
  'des',
  'a',
  'au',
  'aux',
  'et',
  'sarl',
  'sas',
  'sasu',
  'eurl',
  'sa',
  'ste',
  'societe',
  'france',
  'fr',
  'facture',
  'ref',
  'reference',
  'mandat',
  'ics',
  'rum',
  'no',
  'num',
  'numero',
])

/**
 * Retire les accents et met en minuscules.
 * NFD sépare la lettre de son accent, la plage U+0300–U+036F retire l'accent.
 */
export function deburrLower(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Nettoie un libellé bancaire pour n'en garder que la partie signifiante.
 *
 * @example
 * normalizeLabel('CB 2507 INTERMARCHE LESNEVEN 29 CARTE 1234')
 * // => 'intermarche lesneven'
 */
export function normalizeLabel(raw: string): string {
  if (!raw) return ''

  let text = deburrLower(raw)

  // Numéros de carte : « carte 1234 », « no 1234 », « x1234 », « ****1234 ».
  text = text.replace(/\bcarte\s*n?o?\s*\d{4,}\b/g, ' ')
  text = text.replace(/\b[x*]{2,}\s*\d{2,}\b/g, ' ')

  // Dates sous toutes leurs formes : 12/07, 12-07-2026, 2026-07-12, 12.07.26.
  text = text.replace(/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, ' ')
  text = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')

  // Identifiants techniques : suites longues de chiffres, références mixtes.
  text = text.replace(/\b\d{5,}\b/g, ' ')
  text = text.replace(/\b[a-z]{2}\d{2}[a-z0-9]{10,}\b/g, ' ') // IBAN et assimilés
  text = text.replace(/\bref\s*:?\s*\S+/g, ' ')

  // Caractères décoratifs. On conserve lettres, chiffres et espaces.
  text = text.replace(/[^a-z0-9\s]/g, ' ')

  // Espaces multiples.
  text = text.replace(/\s+/g, ' ').trim()

  // Préfixes de type d'opération, éventuellement empilés (« paiement cb cb »).
  let changed = true
  while (changed) {
    changed = false
    for (const prefix of OPERATION_PREFIXES) {
      if (text === prefix) {
        text = ''
        changed = true
        break
      }
      if (text.startsWith(`${prefix} `)) {
        text = text.slice(prefix.length + 1)
        changed = true
        break
      }
    }
  }

  // Nombres isolés restants (jour d'opération, département…).
  text = text
    .split(' ')
    .filter((word) => word !== '' && !/^\d{1,4}$/.test(word))
    .join(' ')

  return text.trim()
}

/**
 * Premiers mots trop génériques pour identifier seuls une enseigne.
 * « credit » ne distingue pas le Crédit Agricole du Crédit Mutuel.
 */
const GENERIC_FIRST_WORDS = new Set([
  'credit',
  'banque',
  'caisse',
  'centre',
  'super',
  'hyper',
  'maison',
  'garage',
  'pharmacie',
  'boulangerie',
])

/**
 * Devine le nom du commerçant à partir d'un libellé normalisé.
 *
 * On ne garde que le premier mot signifiant : « intermarche lesneven » et
 * « intermarche brest » se ramènent tous deux à « intermarche », ce qui permet
 * à la mémoire des corrections de couvrir toute une enseigne d'un coup.
 *
 * Exception faite des premiers mots génériques, où un second mot est conservé
 * pour éviter de confondre deux enseignes différentes.
 */
export function extractMerchant(normalizedLabel: string): string {
  const words = normalizedLabel
    .split(' ')
    .filter((word) => word.length > 1 && !NOISE_WORDS.has(word))

  if (words.length === 0) return ''

  const first = words[0]!
  if (GENERIC_FIRST_WORDS.has(first) && words.length > 1) {
    return `${first} ${words[1]}`
  }
  return first
}

/**
 * Empreinte de déduplication (§11).
 *
 * Composée du compte, de la date, du montant au centime et du libellé
 * normalisé. Deux lignes identiques sur ces quatre critères sont considérées
 * comme la même opération.
 *
 * L'empreinte reste lisible plutôt que hachée : lorsqu'un doublon est signalé
 * à tort, on peut comprendre pourquoi en lisant simplement la valeur stockée.
 */
export function buildFingerprint(input: {
  accountId: string
  date: string
  amount: number
  normalizedLabel: string
}): string {
  const amount = Math.round(input.amount * 100)
  // Le libellé est tronqué : au-delà, deux opérations distinctes du même jour
  // pour le même montant relèvent de toute façon de la vérification humaine.
  const label = input.normalizedLabel.slice(0, 40)
  return `${input.accountId}|${input.date}|${amount}|${label}`
}
