import { describe, expect, it } from 'vitest'

import { clamp, deburr, roundMoney, shortId, sumMoney } from '@/lib/utils'

describe('roundMoney', () => {
  it('arrondit au centime', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(-1.005)).toBe(-1)
  })

  it('laisse les valeurs déjà arrondies inchangées', () => {
    expect(roundMoney(1250.4)).toBe(1250.4)
    expect(roundMoney(0)).toBe(0)
  })
})

describe('sumMoney', () => {
  it('somme sans dérive binaire', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3)
    expect(sumMoney([10.1, -3.05, 0.95])).toBe(8)
  })

  it('renvoie 0 pour une liste vide', () => {
    expect(sumMoney([])).toBe(0)
  })
})

describe('clamp', () => {
  it('limite à l’intervalle', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
  })
})

describe('deburr', () => {
  it('retire les accents et met en minuscules', () => {
    expect(deburr('Éléctricité')).toBe('electricite')
    expect(deburr('CARREFOUR MARKET')).toBe('carrefour market')
    expect(deburr('Café à emporter')).toBe('cafe a emporter')
  })
})

describe('shortId', () => {
  it('génère un identifiant de la longueur demandée', () => {
    expect(shortId(8)).toHaveLength(8)
    expect(shortId(12)).toHaveLength(12)
  })

  it('évite les caractères ambigus', () => {
    const id = shortId(200)
    expect(id).not.toMatch(/[IO01]/)
  })

  it('génère des identifiants différents', () => {
    expect(shortId(10)).not.toBe(shortId(10))
  })
})
