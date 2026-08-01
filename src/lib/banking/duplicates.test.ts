import { describe, expect, it } from 'vitest'

import {
  checkDuplicate,
  checkImportBatch,
  summarize,
  type CandidateOperation,
  type ExistingOperation,
} from '@/lib/banking/duplicates'

const ACCOUNT = 'acc-1'

const existing: ExistingOperation[] = [
  {
    id: 'op-1',
    accountId: ACCOUNT,
    date: '2026-07-12',
    amount: -45.9,
    normalizedLabel: 'intermarche lesneven',
    externalId: 'BNK-001',
  },
  {
    id: 'op-2',
    accountId: ACCOUNT,
    date: '2026-07-15',
    amount: -13.49,
    normalizedLabel: 'netflix',
    externalId: null,
  },
]

function candidate(overrides: Partial<CandidateOperation> = {}): CandidateOperation {
  return {
    accountId: ACCOUNT,
    date: '2026-07-12',
    amount: -45.9,
    normalizedLabel: 'intermarche lesneven',
    externalId: null,
    ...overrides,
  }
}

describe('checkDuplicate', () => {
  it('reconnaît un doublon exact', () => {
    const result = checkDuplicate(candidate(), existing)
    expect(result.verdict).toBe('duplicate')
    expect(result.duplicateOfId).toBe('op-1')
  })

  it('reconnaît un doublon par référence bancaire', () => {
    // Même référence, mais date et libellé différents : c'est la même opération.
    const result = checkDuplicate(
      candidate({ externalId: 'BNK-001', date: '2026-07-14', normalizedLabel: 'autre' }),
      existing,
    )
    expect(result.verdict).toBe('duplicate')
    expect(result.duplicateOfId).toBe('op-1')
  })

  it('accepte une opération nouvelle', () => {
    const result = checkDuplicate(
      candidate({ normalizedLabel: 'boulangerie martin', amount: -8.5 }),
      existing,
    )
    expect(result.verdict).toBe('new')
    expect(result.duplicateOfId).toBeNull()
  })

  it('distingue deux opérations d’un centime d’écart', () => {
    const result = checkDuplicate(candidate({ amount: -45.91 }), existing)
    expect(result.verdict).toBe('new')
  })

  it('ne confond pas deux comptes différents', () => {
    const result = checkDuplicate(candidate({ accountId: 'acc-2' }), existing)
    expect(result.verdict).toBe('new')
  })

  it('signale une opération proche à quelques jours d’écart', () => {
    // Date d'achat contre date de comptabilisation : deux jours d'écart.
    const result = checkDuplicate(candidate({ date: '2026-07-14' }), existing)
    expect(result.verdict).toBe('similar')
    expect(result.duplicateOfId).toBe('op-1')
  })

  it('ne signale plus rien au-delà de la tolérance', () => {
    const result = checkDuplicate(candidate({ date: '2026-07-20' }), existing)
    expect(result.verdict).toBe('new')
  })

  it('ne rapproche pas deux libellés vides', () => {
    const withEmpty: ExistingOperation[] = [
      { id: 'op-3', accountId: ACCOUNT, date: '2026-07-12', amount: -20, normalizedLabel: '', externalId: null },
    ]
    const result = checkDuplicate(
      candidate({ amount: -20, normalizedLabel: '', date: '2026-07-13' }),
      withEmpty,
    )
    expect(result.verdict).toBe('new')
  })

  it('n’est pas trompé par le binaire flottant', () => {
    const withFloat: ExistingOperation[] = [
      {
        id: 'op-4',
        accountId: ACCOUNT,
        date: '2026-07-12',
        amount: 0.1 + 0.2,
        normalizedLabel: 'test',
        externalId: null,
      },
    ]
    const result = checkDuplicate(
      candidate({ amount: 0.3, normalizedLabel: 'test' }),
      withFloat,
    )
    expect(result.verdict).toBe('duplicate')
  })
})

describe('checkImportBatch', () => {
  it('repère les doublons internes au fichier', () => {
    const rows = [
      candidate({ normalizedLabel: 'boulangerie', amount: -8.5, date: '2026-08-01' }),
      candidate({ normalizedLabel: 'boulangerie', amount: -8.5, date: '2026-08-01' }),
    ]

    const results = checkImportBatch(rows, [])
    expect(results[0]!.verdict).toBe('new')
    expect(results[1]!.verdict).toBe('duplicate')
    expect(results[1]!.reason).toContain('ligne 1')
  })

  it('combine doublons internes et doublons en base', () => {
    const rows = [
      candidate(), // doublon de op-1
      candidate({ normalizedLabel: 'nouvelle depense', amount: -12, date: '2026-08-01' }),
      candidate({ normalizedLabel: 'nouvelle depense', amount: -12, date: '2026-08-01' }), // doublon interne
    ]

    const results = checkImportBatch(rows, existing)
    expect(results.map((r) => r.verdict)).toEqual(['duplicate', 'new', 'duplicate'])
  })

  it('renvoie un verdict par ligne, dans l’ordre', () => {
    const rows = [candidate(), candidate({ normalizedLabel: 'x', amount: -1, date: '2026-08-02' })]
    const results = checkImportBatch(rows, existing)

    expect(results).toHaveLength(2)
    expect(results[0]!.rowIndex).toBe(0)
    expect(results[1]!.rowIndex).toBe(1)
  })
})

describe('summarize', () => {
  it('produit le récapitulatif attendu avant validation', () => {
    const summary = summarize(['new', 'new', 'duplicate', 'similar'], 2)

    expect(summary).toEqual({
      total: 6,
      newRows: 2,
      duplicates: 1,
      toReview: 1,
      ignored: 2,
    })
  })

  it('gère un fichier vide', () => {
    expect(summarize([])).toEqual({
      total: 0,
      newRows: 0,
      duplicates: 0,
      toReview: 0,
      ignored: 0,
    })
  })
})
