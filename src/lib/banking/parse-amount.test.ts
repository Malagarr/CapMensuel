import { describe, expect, it } from 'vitest'

import {
  combineDebitCredit,
  detectDecimalSeparator,
  parseBankAmount,
} from '@/lib/banking/parse-amount'

describe('parseBankAmount', () => {
  it('traite les exemples du cahier des charges', () => {
    // §9 étape 2
    expect(parseBankAmount('1 250,45', ',')).toBe(1250.45)
    expect(parseBankAmount('1250.45', '.')).toBe(1250.45)
    expect(parseBankAmount('-89,60', ',')).toBe(-89.6)
  })

  it('gère les séparateurs de milliers', () => {
    expect(parseBankAmount('1.250,45', ',')).toBe(1250.45)
    expect(parseBankAmount('1,250.45', '.')).toBe(1250.45)
    expect(parseBankAmount('1 234 567,89', ',')).toBe(1234567.89)
  })

  it('gère l’espace insécable des copier-coller', () => {
    expect(parseBankAmount('1 250,45', ',')).toBe(1250.45)
    expect(parseBankAmount('1 250,45', ',')).toBe(1250.45)
  })

  it('gère les signes placés devant ou derrière', () => {
    expect(parseBankAmount('-45,90', ',')).toBe(-45.9)
    expect(parseBankAmount('45,90-', ',')).toBe(-45.9)
    expect(parseBankAmount('+45,90', ',')).toBe(45.9)
  })

  it('interprète les parenthèses comptables comme un négatif', () => {
    expect(parseBankAmount('(89,60)', ',')).toBe(-89.6)
    expect(parseBankAmount('(1 250,45)', ',')).toBe(-1250.45)
  })

  it('retire les symboles et codes de devise', () => {
    expect(parseBankAmount('45,90 €', ',')).toBe(45.9)
    expect(parseBankAmount('€45,90', ',')).toBe(45.9)
    expect(parseBankAmount('45.90 EUR', '.')).toBe(45.9)
  })

  it('arrondit au centime', () => {
    expect(parseBankAmount('45.904', '.')).toBe(45.9)
    expect(parseBankAmount('45.906', '.')).toBe(45.91)
  })

  it('accepte zéro et les montants sans décimale', () => {
    expect(parseBankAmount('0', ',')).toBe(0)
    expect(parseBankAmount('1250', ',')).toBe(1250)
  })

  it('rejette ce qui n’est pas un nombre', () => {
    expect(parseBankAmount('', ',')).toBeNull()
    expect(parseBankAmount('   ', ',')).toBeNull()
    expect(parseBankAmount('INTERMARCHE', ',')).toBeNull()
    expect(parseBankAmount('12,34,56', ',')).toBeNull()
    expect(parseBankAmount('-', ',')).toBeNull()
  })
})

describe('detectDecimalSeparator', () => {
  it('reconnaît la virgule décimale française', () => {
    expect(detectDecimalSeparator(['1 250,45', '-89,60', '12,00'])).toBe(',')
  })

  it('reconnaît le point décimal anglo-saxon', () => {
    expect(detectDecimalSeparator(['1250.45', '-89.60', '12.00'])).toBe('.')
  })

  it('tranche grâce au dernier séparateur quand les deux sont présents', () => {
    expect(detectDecimalSeparator(['1.250,45'])).toBe(',')
    expect(detectDecimalSeparator(['1,250.45'])).toBe('.')
  })

  it('ne prend pas un séparateur de milliers pour un décimal', () => {
    // « 1.250 » suivi de trois chiffres : séparateur de milliers.
    // La colonne contient aussi « 12,50 », qui prouve la virgule décimale.
    expect(detectDecimalSeparator(['1.250', '12,50'])).toBe(',')
  })

  it('retombe sur la virgule sans indice', () => {
    expect(detectDecimalSeparator([])).toBe(',')
    expect(detectDecimalSeparator(['1250', '890'])).toBe(',')
  })
})

describe('combineDebitCredit', () => {
  it('rend le débit négatif et le crédit positif', () => {
    expect(combineDebitCredit('45,90', '', ',')).toBe(-45.9)
    expect(combineDebitCredit('', '1 250,00', ',')).toBe(1250)
  })

  it('ne double pas un signe déjà négatif dans la colonne Débit', () => {
    expect(combineDebitCredit('-45,90', '', ',')).toBe(-45.9)
  })

  it('force le crédit en positif', () => {
    expect(combineDebitCredit('', '-1 250,00', ',')).toBe(1250)
  })

  it('ignore les zéros et les cellules vides', () => {
    expect(combineDebitCredit('0', '1 250,00', ',')).toBe(1250)
    expect(combineDebitCredit('', '', ',')).toBeNull()
    expect(combineDebitCredit(null, undefined, ',')).toBeNull()
  })

  it('donne la priorité au débit si les deux colonnes sont remplies', () => {
    // Cas anormal, mais qui ne doit pas produire un montant fantaisiste.
    expect(combineDebitCredit('45,90', '10,00', ',')).toBe(-45.9)
  })
})
