import { describe, expect, it } from 'vitest'

import {
  analyzeSheet,
  buildImportPreview,
  summarizeImportRecap,
  summarizePreview,
} from '@/lib/banking/import-pipeline'
import type { CategorizationContext } from '@/lib/banking/categorize'
import type { ExistingOperation } from '@/lib/banking/duplicates'
import type { ParsedSheet } from '@/lib/banking/read-file'

const ACCOUNT = 'acc-1'
const ALIMENTATION = 'cat-alimentation'
const ELECTRICITE = 'cat-electricite'

const context: CategorizationContext = {
  categories: [
    { id: ALIMENTATION, name: 'Alimentation', categoryType: 'variable_expense', isActive: true },
    { id: ELECTRICITE, name: 'Électricité', categoryType: 'fixed_expense', isActive: true },
  ],
  userRules: [],
  merchants: [],
  recurrings: [],
  knownLabels: [],
}

describe('analyzeSheet', () => {
  it('traite l’exemple complet du cahier des charges (§9)', () => {
    const sheet: ParsedSheet = {
      rows: [
        ['Date opération', 'Libellé simplifié', 'Débit', 'Crédit'],
        ['12/07/2026', 'INTERMARCHE LESNEVEN', '45,90', ''],
        ['13/07/2026', 'VIREMENT SALAIRE', '', '1 250,45'],
        ['25/07/2026', 'EDF', '89,60', ''],
      ],
      columnCount: 4,
    }

    const result = analyzeSheet(sheet)

    expect(result.hasHeader).toBe(true)
    expect(result.mapping.date).toBe(0)
    expect(result.mapping.label).toBe(1)
    expect(result.mapping.debit).toBe(2)
    expect(result.mapping.credit).toBe(3)
    expect(result.dateOrder).toBe('dmy')
    expect(result.dateOrderCertain).toBe(true)
    expect(result.decimalSeparator).toBe(',')
    expect(result.dataRows).toHaveLength(3)
  })

  it('fabrique des noms de colonnes quand il n’y a pas d’en-tête', () => {
    const sheet: ParsedSheet = {
      rows: [['12/07/2026', 'INTERMARCHE', '-45,90']],
      columnCount: 3,
    }

    const result = analyzeSheet(sheet)
    expect(result.hasHeader).toBe(false)
    expect(result.headerRow).toEqual(['Colonne 1', 'Colonne 2', 'Colonne 3'])
    expect(result.dataRows).toHaveLength(1)
  })

  it('produit une empreinte stable pour reconnaître la banque au prochain import', () => {
    const sheet: ParsedSheet = {
      rows: [['Date opération', 'Libellé', 'Montant']],
      columnCount: 3,
    }
    const result = analyzeSheet(sheet)
    expect(result.signature).toBe('date operation|libelle|montant')
  })
})

describe('buildImportPreview', () => {
  const dataRows = [
    ['12/07/2026', 'CB INTERMARCHE LESNEVEN', '45,90', ''],
    ['20/07/2026', 'PRELEVEMENT EDF', '89,60', ''],
    ['22/07/2026', 'VIREMENT SALAIRE', '', '2450,00'],
  ]

  const mapping = { date: 0, label: 1, debit: 2, credit: 3 }

  it('traite un relevé complet de bout en bout', () => {
    const rows = buildImportPreview({
      dataRows,
      mapping,
      dateOrder: 'dmy',
      decimalSeparator: ',',
      accountId: ACCOUNT,
      existingOperations: [],
      categorization: context,
    })

    expect(rows).toHaveLength(3)

    // Intermarché : reconnu par mots-clés (confiance 75 -> « à confirmer »,
    // le dictionnaire ne peut jamais atteindre le seuil de validation automatique).
    expect(rows[0]!.parsedDate).toBe('2026-07-12')
    expect(rows[0]!.parsedAmount).toBe(-45.9)
    expect(rows[0]!.suggestedCategoryId).toBe(ALIMENTATION)
    expect(rows[0]!.status).toBe('suggested')

    // EDF : électricité.
    expect(rows[1]!.suggestedCategoryId).toBe(ELECTRICITE)

    // Salaire au crédit : aucune catégorie de revenu dans ce contexte de test.
    expect(rows[2]!.parsedAmount).toBe(2450)
    expect(rows[2]!.suggestedCategoryId).toBeNull()
  })

  it('signale les doublons face à l’existant', () => {
    const existing: ExistingOperation[] = [
      {
        id: 'existing-1',
        accountId: ACCOUNT,
        date: '2026-07-12',
        amount: -45.9,
        normalizedLabel: 'intermarche lesneven',
        externalId: null,
      },
    ]

    const rows = buildImportPreview({
      dataRows,
      mapping,
      dateOrder: 'dmy',
      decimalSeparator: ',',
      accountId: ACCOUNT,
      existingOperations: existing,
      categorization: context,
    })

    expect(rows[0]!.status).toBe('duplicate')
    expect(rows[0]!.duplicateOfId).toBe('existing-1')
    // Un doublon certain est décoché par défaut.
    expect(rows[0]!.included).toBe(false)
    // Mais reste modifiable : l'utilisateur peut forcer l'import (§11).
    expect(rows[1]!.included).toBe(true)
  })

  it('détecte les doublons internes au fichier lui-même', () => {
    const duplicatedRows = [dataRows[0]!, dataRows[0]!]

    const rows = buildImportPreview({
      dataRows: duplicatedRows,
      mapping,
      dateOrder: 'dmy',
      decimalSeparator: ',',
      accountId: ACCOUNT,
      existingOperations: [],
      categorization: context,
    })

    expect(rows[0]!.status).not.toBe('duplicate')
    expect(rows[1]!.status).toBe('duplicate')
  })

  it('marque une ligne comme invalide quand la date est illisible', () => {
    const rows = buildImportPreview({
      dataRows: [['pas une date', 'INTERMARCHE', '45,90', '']],
      mapping,
      dateOrder: 'dmy',
      decimalSeparator: ',',
      accountId: ACCOUNT,
      existingOperations: [],
      categorization: context,
    })

    expect(rows[0]!.status).toBe('invalid')
    expect(rows[0]!.included).toBe(false)
    expect(rows[0]!.categoryReason).toContain('Date')
  })

  it('marque une ligne comme invalide quand le montant est illisible', () => {
    const rows = buildImportPreview({
      dataRows: [['12/07/2026', 'INTERMARCHE', 'pas un montant', '']],
      mapping,
      dateOrder: 'dmy',
      decimalSeparator: ',',
      accountId: ACCOUNT,
      existingOperations: [],
      categorization: context,
    })

    expect(rows[0]!.status).toBe('invalid')
  })

  it('ignore une ligne à montant nul', () => {
    // Une ligne à 0,00 (frais annulés, par exemple) ne doit jamais être
    // importée : la contrainte transactions_amount_nonzero la rejetterait.
    const rows = buildImportPreview({
      dataRows: [['12/07/2026', 'FRAIS ANNULES', '0,00', '']],
      mapping,
      dateOrder: 'dmy',
      decimalSeparator: ',',
      accountId: ACCOUNT,
      existingOperations: [],
      categorization: context,
    })

    expect(rows[0]!.status).toBe('invalid')
    expect(rows[0]!.included).toBe(false)
  })

  it('conserve l’ordre des lignes du fichier', () => {
    const rows = buildImportPreview({
      dataRows,
      mapping,
      dateOrder: 'dmy',
      decimalSeparator: ',',
      accountId: ACCOUNT,
      existingOperations: [],
      categorization: context,
    })

    expect(rows.map((row) => row.rowIndex)).toEqual([0, 1, 2])
  })
})

describe('summarizePreview', () => {
  it('produit le récapitulatif attendu avant validation (§9 étape 4)', () => {
    const rows = buildImportPreview({
      dataRows: [
        ['12/07/2026', 'CB INTERMARCHE', '45,90', ''],
        ['20/07/2026', 'PRELEVEMENT EDF', '89,60', ''],
        ['pas une date', 'INCONNU', '10,00', ''],
      ],
      mapping: { date: 0, label: 1, debit: 2, credit: 3 },
      dateOrder: 'dmy',
      decimalSeparator: ',',
      accountId: ACCOUNT,
      existingOperations: [
        {
          id: 'existing-1',
          accountId: ACCOUNT,
          date: '2026-07-12',
          amount: -45.9,
          normalizedLabel: 'intermarche',
          externalId: null,
        },
      ],
      categorization: context,
    })

    const summary = summarizePreview(rows)
    expect(summary.total).toBe(3)
    expect(summary.duplicates).toBe(1)
    expect(summary.invalid).toBe(1)
    expect(summary.suggested).toBe(1) // EDF, reconnu par mots-clés
  })
})

describe('summarizeImportRecap', () => {
  it('répartit chaque ligne dans une seule des quatre catégories affichées à l’utilisateur', () => {
    const rows = buildImportPreview({
      dataRows: [
        ['12/07/2026', 'CB INTERMARCHE', '45,90', ''], // doublon
        ['20/07/2026', 'PRELEVEMENT EDF', '89,60', ''], // suggéré -> nouvelle
        ['22/07/2026', 'VIREMENT INCONNU', '', '10,00'], // non reconnu -> à vérifier
        ['pas une date', 'INCONNU', '10,00', ''], // ignorée
      ],
      mapping: { date: 0, label: 1, debit: 2, credit: 3 },
      dateOrder: 'dmy',
      decimalSeparator: ',',
      accountId: ACCOUNT,
      existingOperations: [
        {
          id: 'existing-1',
          accountId: ACCOUNT,
          date: '2026-07-12',
          amount: -45.9,
          normalizedLabel: 'intermarche',
          externalId: null,
        },
      ],
      categorization: context,
    })

    const recap = summarizeImportRecap(rows)
    expect(recap).toEqual({ total: 4, nouvelles: 1, doublons: 1, aVerifier: 1, ignorees: 1 })
    // La somme des quatre catégories couvre exactement toutes les lignes.
    expect(recap.nouvelles + recap.doublons + recap.aVerifier + recap.ignorees).toBe(recap.total)
  })
})
