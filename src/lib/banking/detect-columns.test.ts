import { describe, expect, it } from 'vitest'

import {
  detectColumns,
  headerSignature,
  looksLikeHeaderRow,
} from '@/lib/banking/detect-columns'

describe('detectColumns', () => {
  it('traite l’exemple du cahier des charges', () => {
    // §9 étape 3
    const result = detectColumns([
      'Date opération',
      'Libellé simplifié',
      'Débit',
      'Crédit',
    ])

    expect(result.mapping.date).toBe(0)
    expect(result.mapping.label).toBe(1)
    expect(result.mapping.debit).toBe(2)
    expect(result.mapping.credit).toBe(3)
  })

  it('distingue la date de valeur de la date d’opération', () => {
    const result = detectColumns(['Date de valeur', 'Date opération', 'Libellé', 'Montant'])

    expect(result.mapping.valueDate).toBe(0)
    expect(result.mapping.date).toBe(1)
  })

  it('reconnaît un format à montant signé', () => {
    const result = detectColumns(['Date', 'Libellé', 'Montant', 'Devise'])

    expect(result.mapping.date).toBe(0)
    expect(result.mapping.label).toBe(1)
    expect(result.mapping.amount).toBe(2)
    expect(result.mapping.currency).toBe(3)
    expect(result.mapping.debit).toBeUndefined()
  })

  it('reconnaît des en-têtes en anglais', () => {
    const result = detectColumns(['Transaction Date', 'Description', 'Amount', 'Currency'])

    expect(result.mapping.date).toBe(0)
    expect(result.mapping.label).toBe(1)
    expect(result.mapping.amount).toBe(2)
  })

  it('ignore la casse et les accents', () => {
    const result = detectColumns(['DATE OPERATION', 'LIBELLE', 'MONTANT'])

    expect(result.mapping.date).toBe(0)
    expect(result.mapping.label).toBe(1)
    expect(result.mapping.amount).toBe(2)
  })

  it('n’attribue jamais deux fois la même colonne', () => {
    const result = detectColumns(['Date', 'Date', 'Libellé', 'Montant'])
    const indexes = Object.values(result.mapping)

    expect(new Set(indexes).size).toBe(indexes.length)
  })

  it('signale les champs indispensables absents', () => {
    const result = detectColumns(['Colonne A', 'Colonne B', 'Colonne C'])

    expect(result.uncertain).toContain('date')
    expect(result.uncertain).toContain('label')
    expect(result.uncertain).toContain('amount')
  })

  it('signale un montant ambigu quand débit et crédit existent aussi', () => {
    const result = detectColumns(['Date', 'Libellé', 'Débit', 'Crédit', 'Montant'])

    expect(result.uncertain).toContain('amount')
  })

  it('ne signale rien d’essentiel sur un fichier bien formé', () => {
    const result = detectColumns(['Date opération', 'Libellé', 'Débit', 'Crédit'])

    expect(result.uncertain).not.toContain('date')
    expect(result.uncertain).not.toContain('label')
    expect(result.uncertain).not.toContain('amount')
  })
})

describe('looksLikeHeaderRow', () => {
  it('reconnaît une ligne d’en-tête', () => {
    expect(looksLikeHeaderRow(['Date', 'Libellé', 'Montant'])).toBe(true)
  })

  it('reconnaît une ligne d’opération', () => {
    expect(looksLikeHeaderRow(['12/07/2026', 'INTERMARCHE', '-45,90'])).toBe(false)
  })

  it('rejette une ligne contenant un montant', () => {
    expect(looksLikeHeaderRow(['Opération', 'Détail', '1 250,45'])).toBe(false)
  })

  it('rejette une ligne vide', () => {
    expect(looksLikeHeaderRow(['', '  ', ''])).toBe(false)
  })
})

describe('headerSignature', () => {
  it('produit la même empreinte pour deux exports de la même banque', () => {
    const a = headerSignature(['Date opération', 'Libellé', 'Débit', 'Crédit'])
    const b = headerSignature(['DATE OPÉRATION', 'libellé', 'DÉBIT', 'Crédit'])

    expect(a).toBe(b)
  })

  it('distingue deux banques différentes', () => {
    const a = headerSignature(['Date opération', 'Libellé', 'Débit', 'Crédit'])
    const b = headerSignature(['Date', 'Description', 'Montant'])

    expect(a).not.toBe(b)
  })

  it('ignore les colonnes vides en fin de ligne', () => {
    const a = headerSignature(['Date', 'Libellé', 'Montant'])
    const b = headerSignature(['Date', 'Libellé', 'Montant', '', ''])

    expect(a).toBe(b)
  })
})
