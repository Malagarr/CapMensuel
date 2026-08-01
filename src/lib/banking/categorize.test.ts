import { describe, expect, it } from 'vitest'

import {
  confidenceLevel,
  matchesRule,
  suggestCategory,
  type CategorizationContext,
  type OperationToClassify,
} from '@/lib/banking/categorize'

const ALIMENTATION = 'cat-alimentation'
const ELECTRICITE = 'cat-electricite'
const ABONNEMENTS = 'cat-abonnements'
const SALAIRE = 'cat-salaire'
const LOISIRS = 'cat-loisirs'
const ARCHIVEE = 'cat-archivee'

const baseContext: CategorizationContext = {
  categories: [
    { id: ALIMENTATION, name: 'Alimentation', categoryType: 'variable_expense', isActive: true },
    { id: ELECTRICITE, name: 'Électricité', categoryType: 'fixed_expense', isActive: true },
    { id: ABONNEMENTS, name: 'Abonnements', categoryType: 'fixed_expense', isActive: true },
    { id: SALAIRE, name: 'Salaire', categoryType: 'income', isActive: true },
    { id: LOISIRS, name: 'Loisirs', categoryType: 'variable_expense', isActive: true },
    { id: ARCHIVEE, name: 'Ancienne', categoryType: 'variable_expense', isActive: false },
  ],
  userRules: [],
  merchants: [],
  recurrings: [],
  knownLabels: [],
}

function operation(overrides: Partial<OperationToClassify> = {}): OperationToClassify {
  return {
    rawLabel: 'CB INTERMARCHE',
    normalizedLabel: 'intermarche lesneven',
    merchant: 'intermarche',
    amount: -45.9,
    accountId: 'acc-1',
    ...overrides,
  }
}

describe('suggestCategory — exemples du cahier des charges (§10)', () => {
  it('classe Intermarché en alimentation', () => {
    const result = suggestCategory(operation(), baseContext)
    expect(result.categoryId).toBe(ALIMENTATION)
    expect(result.source).toBe('keyword')
  })

  it('classe Leclerc en alimentation', () => {
    const result = suggestCategory(
      operation({ normalizedLabel: 'leclerc brest', merchant: 'leclerc' }),
      baseContext,
    )
    expect(result.categoryId).toBe(ALIMENTATION)
  })

  it('classe EDF en électricité', () => {
    const result = suggestCategory(
      operation({ normalizedLabel: 'edf', merchant: 'edf', amount: -124.6 }),
      baseContext,
    )
    expect(result.categoryId).toBe(ELECTRICITE)
  })

  it('classe Netflix en abonnement', () => {
    const result = suggestCategory(
      operation({ normalizedLabel: 'netflix', merchant: 'netflix', amount: -13.49 }),
      baseContext,
    )
    expect(result.categoryId).toBe(ABONNEMENTS)
  })

  it('classe un salaire en revenu', () => {
    const result = suggestCategory(
      operation({ normalizedLabel: 'salaire employeur', merchant: 'salaire', amount: 2450 }),
      baseContext,
    )
    expect(result.categoryId).toBe(SALAIRE)
  })
})

describe('suggestCategory — hiérarchie de priorité (§28)', () => {
  it('donne la priorité absolue à une règle de l’utilisateur', () => {
    const context: CategorizationContext = {
      ...baseContext,
      // Le dictionnaire dirait « Alimentation » ; la règle dit « Loisirs ».
      userRules: [
        {
          id: 'r1',
          matchType: 'contains',
          matchValue: 'INTERMARCHE',
          categoryId: LOISIRS,
          accountId: null,
          priority: 100,
          ruleName: 'Intermarché en loisirs',
        },
      ],
    }

    const result = suggestCategory(operation(), context)
    expect(result.categoryId).toBe(LOISIRS)
    expect(result.source).toBe('user_rule')
    expect(result.confidence).toBe(100)
  })

  it('applique la règle de plus haute priorité', () => {
    const context: CategorizationContext = {
      ...baseContext,
      userRules: [
        {
          id: 'r1',
          matchType: 'contains',
          matchValue: 'intermarche',
          categoryId: LOISIRS,
          accountId: null,
          priority: 50,
          ruleName: 'Basse priorité',
        },
        {
          id: 'r2',
          matchType: 'contains',
          matchValue: 'intermarche',
          categoryId: ALIMENTATION,
          accountId: null,
          priority: 200,
          ruleName: 'Haute priorité',
        },
      ],
    }

    expect(suggestCategory(operation(), context).categoryId).toBe(ALIMENTATION)
  })

  it('ignore une règle limitée à un autre compte', () => {
    const context: CategorizationContext = {
      ...baseContext,
      userRules: [
        {
          id: 'r1',
          matchType: 'contains',
          matchValue: 'intermarche',
          categoryId: LOISIRS,
          accountId: 'acc-2',
          priority: 100,
          ruleName: 'Autre compte',
        },
      ],
    }

    const result = suggestCategory(operation({ accountId: 'acc-1' }), context)
    expect(result.source).toBe('keyword')
  })

  it('place la mémoire des corrections au-dessus du dictionnaire', () => {
    const context: CategorizationContext = {
      ...baseContext,
      merchants: [{ normalizedMerchant: 'intermarche', categoryId: LOISIRS }],
    }

    const result = suggestCategory(operation(), context)
    expect(result.categoryId).toBe(LOISIRS)
    expect(result.source).toBe('merchant_memory')
    expect(result.confidence).toBe(95)
  })

  it('reconnaît une opération récurrente déclarée', () => {
    const context: CategorizationContext = {
      ...baseContext,
      recurrings: [
        { id: 'rec1', normalizedLabel: 'edf', categoryId: ELECTRICITE, expectedAmount: -120 },
      ],
    }

    const result = suggestCategory(
      operation({ normalizedLabel: 'edf prelevement mensuel', merchant: 'edf', amount: -124.6 }),
      context,
    )
    expect(result.source).toBe('recurring')
    expect(result.categoryId).toBe(ELECTRICITE)
  })

  it('réutilise un libellé déjà classé à l’identique', () => {
    const context: CategorizationContext = {
      ...baseContext,
      knownLabels: [{ normalizedLabel: 'boucherie martin', categoryId: ALIMENTATION }],
    }

    const result = suggestCategory(
      operation({ normalizedLabel: 'boucherie martin', merchant: 'boucherie martin' }),
      context,
    )
    expect(result.source).toBe('exact_label')
    expect(result.confidence).toBe(88)
  })
})

describe('suggestCategory — garde-fous', () => {
  it('ne propose jamais une catégorie archivée', () => {
    const context: CategorizationContext = {
      ...baseContext,
      merchants: [{ normalizedMerchant: 'intermarche', categoryId: ARCHIVEE }],
    }

    const result = suggestCategory(operation(), context)
    // La mémoire pointe vers une catégorie archivée : on descend d'un niveau.
    expect(result.categoryId).toBe(ALIMENTATION)
    expect(result.source).toBe('keyword')
  })

  it('ne classe pas un crédit dans une catégorie de dépense', () => {
    // Un remboursement Intermarché arrive au crédit : le dictionnaire des
    // dépenses ne doit pas s'appliquer.
    const result = suggestCategory(operation({ amount: 45.9 }), baseContext)
    expect(result.categoryId).toBeNull()
  })

  it('renvoie « inconnu » quand rien ne correspond', () => {
    const result = suggestCategory(
      operation({ normalizedLabel: 'xyz inconnu', merchant: 'xyz' }),
      baseContext,
    )
    expect(result.categoryId).toBeNull()
    expect(result.confidence).toBe(0)
    expect(result.source).toBe('none')
  })

  it('ne propose rien si la catégorie du dictionnaire n’existe pas', () => {
    const context: CategorizationContext = { ...baseContext, categories: [] }
    expect(suggestCategory(operation(), context).categoryId).toBeNull()
  })
})

describe('matchesRule', () => {
  it('gère les quatre comparaisons simples', () => {
    expect(matchesRule('intermarche lesneven', 'contains', 'MARCHE')).toBe(true)
    expect(matchesRule('intermarche lesneven', 'equals', 'intermarche lesneven')).toBe(true)
    expect(matchesRule('intermarche lesneven', 'equals', 'intermarche')).toBe(false)
    expect(matchesRule('intermarche lesneven', 'starts_with', 'inter')).toBe(true)
    expect(matchesRule('intermarche lesneven', 'ends_with', 'lesneven')).toBe(true)
  })

  it('ignore la casse et les accents du motif', () => {
    expect(matchesRule('electricite de france', 'contains', 'ÉLECTRICITÉ')).toBe(true)
  })

  it('gère les expressions régulières', () => {
    expect(matchesRule('cb 1234 total', 'regex', 'total|esso')).toBe(true)
    expect(matchesRule('cb 1234 shell', 'regex', 'total|esso')).toBe(false)
  })

  it('ne casse pas sur une expression régulière invalide', () => {
    expect(matchesRule('intermarche', 'regex', '[invalide')).toBe(false)
  })

  it('rejette un motif vide', () => {
    expect(matchesRule('intermarche', 'contains', '   ')).toBe(false)
  })
})

describe('confidenceLevel', () => {
  it('applique les seuils du cahier des charges', () => {
    // §28 : 95-100 automatique, 70-94 à confirmer, moins de 70 à demander.
    expect(confidenceLevel(100)).toBe('auto')
    expect(confidenceLevel(95)).toBe('auto')
    expect(confidenceLevel(94)).toBe('suggested')
    expect(confidenceLevel(70)).toBe('suggested')
    expect(confidenceLevel(69)).toBe('ask')
    expect(confidenceLevel(0)).toBe('ask')
  })
})
