import { describe, expect, it } from 'vitest'

import { parseAmountInput } from '@/lib/validation/account'

describe('parseAmountInput', () => {
  it('lit un montant à la française', () => {
    expect(parseAmountInput('1 250,45')).toBe(1250.45)
    expect(parseAmountInput('89,60')).toBe(89.6)
  })

  it('lit un montant au format anglo-saxon', () => {
    expect(parseAmountInput('1250.45')).toBe(1250.45)
  })

  it('accepte le symbole monétaire', () => {
    expect(parseAmountInput('1 250,45 €')).toBe(1250.45)
    expect(parseAmountInput('$1250.45')).toBe(1250.45)
  })

  it('accepte le signe négatif', () => {
    expect(parseAmountInput('-89,60')).toBe(-89.6)
  })

  it('accepte l’espace insécable des relevés copiés-collés', () => {
    expect(parseAmountInput('1 250,45')).toBe(1250.45)
    expect(parseAmountInput('1 250,45')).toBe(1250.45)
  })

  it('renvoie null pour une saisie vide ou incomplète', () => {
    expect(parseAmountInput('')).toBeNull()
    expect(parseAmountInput('  ')).toBeNull()
    expect(parseAmountInput('-')).toBeNull()
    expect(parseAmountInput('+')).toBeNull()
  })

  it('renvoie null pour une saisie non numérique', () => {
    expect(parseAmountInput('abc')).toBeNull()
    expect(parseAmountInput('12,34,56')).toBeNull()
  })
})
