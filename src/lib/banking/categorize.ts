import { KEYWORD_RULES } from '@/lib/banking/keywords'
import { deburrLower } from '@/lib/banking/normalize'
import type { CategoryKind, RuleMatchType } from '@/types/database'

/**
 * Moteur de catégorisation (§28).
 *
 * Les niveaux sont essayés dans l'ordre, du plus fiable au plus approximatif.
 * Le premier qui répond l'emporte : une règle écrite par l'utilisateur ne doit
 * jamais être contredite par une déduction automatique.
 *
 *   1. règle créée par l'utilisateur          100
 *   2. commerçant déjà corrigé                 95
 *   3. opération récurrente reconnue           92
 *   4. libellé déjà rencontré à l'identique    88
 *   5. dictionnaire de mots-clés               75
 *   6. inconnu                                  0
 *
 * Le score de confiance guide l'interface : au-dessus de 95 l'opération peut
 * être validée d'office, entre 70 et 94 elle est proposée, en dessous elle est
 * soumise à l'utilisateur.
 */

export type MatchSource =
  | 'user_rule'
  | 'merchant_memory'
  | 'recurring'
  | 'exact_label'
  | 'keyword'
  | 'none'

export type CategorySuggestion = {
  categoryId: string | null
  confidence: number
  source: MatchSource
  /** Explication affichable, pour que l'utilisateur comprenne le classement. */
  reason: string
}

export type CategoryRef = {
  id: string
  name: string
  categoryType: CategoryKind
  isActive: boolean
}

export type UserRule = {
  id: string
  matchType: RuleMatchType
  matchValue: string
  categoryId: string
  /** null = toutes les banques du foyer. */
  accountId: string | null
  priority: number
  ruleName: string
}

export type MerchantMemory = {
  normalizedMerchant: string
  categoryId: string
}

export type RecurringRef = {
  id: string
  normalizedLabel: string
  categoryId: string | null
  expectedAmount: number
}

export type KnownLabel = {
  normalizedLabel: string
  categoryId: string
}

export type CategorizationContext = {
  categories: CategoryRef[]
  userRules: UserRule[]
  merchants: MerchantMemory[]
  recurrings: RecurringRef[]
  knownLabels: KnownLabel[]
}

export type OperationToClassify = {
  rawLabel: string
  normalizedLabel: string
  merchant: string
  amount: number
  accountId: string
}

/** Vrai si la valeur correspond au motif selon le type de comparaison. */
export function matchesRule(
  normalizedLabel: string,
  matchType: RuleMatchType,
  matchValue: string,
): boolean {
  const haystack = normalizedLabel
  const needle = deburrLower(matchValue).trim()
  if (needle === '') return false

  switch (matchType) {
    case 'equals':
      return haystack === needle
    case 'starts_with':
      return haystack.startsWith(needle)
    case 'ends_with':
      return haystack.endsWith(needle)
    case 'contains':
      return haystack.includes(needle)
    case 'regex':
      try {
        // Une expression régulière écrite par l'utilisateur peut être invalide,
        // voire coûteuse. On la borne et on ignore silencieusement ses erreurs.
        if (needle.length > 200) return false
        return new RegExp(needle, 'i').test(haystack)
      } catch {
        return false
      }
    default:
      return false
  }
}

/**
 * Nature attendue d'une catégorie selon le sens du montant.
 *
 * Exportée (au-delà de son usage interne à suggestCategory) pour que
 * l'interface d'import puisse limiter le sélecteur de catégorie aux natures
 * plausibles pour le montant de la ligne, sans dupliquer la règle.
 */
export function expectedCategoryKinds(amount: number): CategoryKind[] {
  return amount >= 0
    ? ['income', 'savings', 'transfer']
    : ['fixed_expense', 'variable_expense', 'exceptional_expense', 'savings', 'transfer']
}

/**
 * Propose une catégorie pour une opération.
 *
 * La fonction est pure : elle ne consulte aucune base et se contente du
 * contexte fourni. C'est ce qui la rend testable et permet de classer un
 * fichier entier dans le navigateur, sans aller-retour serveur.
 */
export function suggestCategory(
  operation: OperationToClassify,
  context: CategorizationContext,
): CategorySuggestion {
  const categoryById = new Map(context.categories.map((category) => [category.id, category]))

  /** Une catégorie n'est retenue que si elle existe encore et reste active. */
  function usable(categoryId: string | null | undefined): boolean {
    if (!categoryId) return false
    const category = categoryById.get(categoryId)
    return Boolean(category?.isActive)
  }

  // --- 1. Règles de l'utilisateur -----------------------------------------
  // Triées par priorité décroissante : la plus prioritaire gagne.
  const applicableRules = context.userRules
    .filter((rule) => rule.accountId === null || rule.accountId === operation.accountId)
    .sort((a, b) => b.priority - a.priority)

  for (const rule of applicableRules) {
    if (
      matchesRule(operation.normalizedLabel, rule.matchType, rule.matchValue) &&
      usable(rule.categoryId)
    ) {
      return {
        categoryId: rule.categoryId,
        confidence: 100,
        source: 'user_rule',
        reason: `Votre règle « ${rule.ruleName} »`,
      }
    }
  }

  // --- 2. Mémoire des corrections ------------------------------------------
  if (operation.merchant !== '') {
    const memory = context.merchants.find(
      (entry) => entry.normalizedMerchant === operation.merchant,
    )
    if (memory && usable(memory.categoryId)) {
      return {
        categoryId: memory.categoryId,
        confidence: 95,
        source: 'merchant_memory',
        reason: 'Vous avez déjà classé ce commerçant ainsi',
      }
    }
  }

  // --- 3. Opérations récurrentes -------------------------------------------
  for (const recurring of context.recurrings) {
    if (recurring.normalizedLabel === '' || !usable(recurring.categoryId)) continue

    const labelMatches =
      operation.normalizedLabel.includes(recurring.normalizedLabel) ||
      recurring.normalizedLabel.includes(operation.normalizedLabel)

    if (labelMatches) {
      return {
        categoryId: recurring.categoryId,
        confidence: 92,
        source: 'recurring',
        reason: 'Correspond à une opération récurrente déclarée',
      }
    }
  }

  // --- 4. Libellé déjà rencontré à l'identique ------------------------------
  if (operation.normalizedLabel !== '') {
    const known = context.knownLabels.find(
      (entry) => entry.normalizedLabel === operation.normalizedLabel,
    )
    if (known && usable(known.categoryId)) {
      return {
        categoryId: known.categoryId,
        confidence: 88,
        source: 'exact_label',
        reason: 'Même libellé qu’une opération déjà classée',
      }
    }
  }

  // --- 5. Dictionnaire de mots-clés ----------------------------------------
  const allowedKinds = expectedCategoryKinds(operation.amount)

  for (const rule of KEYWORD_RULES) {
    // Le sens du montant doit correspondre : « CAF » est un revenu au crédit,
    // mais une dépense de crèche au débit.
    if (!allowedKinds.includes(rule.kind)) continue

    const matched = rule.patterns.some((pattern) =>
      operation.normalizedLabel.includes(pattern),
    )
    if (!matched) continue

    const category = context.categories.find(
      (candidate) =>
        candidate.isActive &&
        candidate.categoryType === rule.kind &&
        deburrLower(candidate.name) === deburrLower(rule.categoryName),
    )

    if (category) {
      return {
        categoryId: category.id,
        confidence: 75,
        source: 'keyword',
        reason: `Enseigne reconnue : ${rule.categoryName}`,
      }
    }
  }

  // --- 6. Inconnu -----------------------------------------------------------
  return {
    categoryId: null,
    confidence: 0,
    source: 'none',
    reason: 'Aucune correspondance trouvée',
  }
}

/** Seuils d'interprétation du score (§28). */
export function confidenceLevel(confidence: number): 'auto' | 'suggested' | 'ask' {
  if (confidence >= 95) return 'auto'
  if (confidence >= 70) return 'suggested'
  return 'ask'
}
