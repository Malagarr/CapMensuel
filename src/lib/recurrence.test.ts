import { describe, expect, it } from 'vitest'

import { daysInMonth, nextOccurrence, occurrencesUntil } from '@/lib/recurrence'

describe('daysInMonth', () => {
  it('connaît la longueur des mois', () => {
    expect(daysInMonth(2026, 1)).toBe(31)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 2)).toBe(28)
  })

  it('gère les années bissextiles', () => {
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2100, 2)).toBe(28) // 2100 n'est pas bissextile
    expect(daysInMonth(2000, 2)).toBe(29) // 2000 l'est
  })
})

describe('nextOccurrence', () => {
  it('avance d’un mois', () => {
    expect(nextOccurrence('2026-08-05', 'monthly', 5)).toBe('2026-09-05')
  })

  it('passe correctement d’une année à l’autre', () => {
    expect(nextOccurrence('2026-12-15', 'monthly', 15)).toBe('2027-01-15')
    expect(nextOccurrence('2026-11-10', 'quarterly', 10)).toBe('2027-02-10')
  })

  it('ramène au dernier jour quand le mois est trop court', () => {
    // Un prélèvement prévu le 31 tombe le 28 février, comme à la banque.
    expect(nextOccurrence('2026-01-31', 'monthly', 31)).toBe('2026-02-28')
    expect(nextOccurrence('2026-03-31', 'monthly', 31)).toBe('2026-04-30')
  })

  it('retrouve le bon jour après un mois court', () => {
    // Le jour habituel reste 31 : après février, on revient au 31 mars.
    expect(nextOccurrence('2026-02-28', 'monthly', 31)).toBe('2026-03-31')
  })

  it('gère le 29 février d’une année bissextile', () => {
    expect(nextOccurrence('2028-01-29', 'monthly', 29)).toBe('2028-02-29')
    expect(nextOccurrence('2026-01-29', 'monthly', 29)).toBe('2026-02-28')
  })

  it('avance en semaines', () => {
    expect(nextOccurrence('2026-08-05', 'weekly')).toBe('2026-08-12')
    expect(nextOccurrence('2026-08-05', 'biweekly')).toBe('2026-08-19')
  })

  it('franchit la fin du mois en hebdomadaire', () => {
    expect(nextOccurrence('2026-08-28', 'weekly')).toBe('2026-09-04')
  })

  it('avance en trimestres, semestres et années', () => {
    expect(nextOccurrence('2026-01-15', 'quarterly', 15)).toBe('2026-04-15')
    expect(nextOccurrence('2026-01-15', 'semiannual', 15)).toBe('2026-07-15')
    expect(nextOccurrence('2026-01-15', 'yearly', 15)).toBe('2027-01-15')
    expect(nextOccurrence('2026-01-15', 'bimonthly', 15)).toBe('2026-03-15')
  })

  it('ne répète pas une opération ponctuelle', () => {
    expect(nextOccurrence('2026-08-05', 'one_off')).toBeNull()
  })
})

describe('occurrencesUntil', () => {
  it('liste les échéances mensuelles d’un trimestre', () => {
    expect(occurrencesUntil('2026-08-05', '2026-10-31', 'monthly', { dayOfMonth: 5 })).toEqual([
      '2026-08-05',
      '2026-09-05',
      '2026-10-05',
    ])
  })

  it('s’arrête à la date de fin de la récurrence', () => {
    const dates = occurrencesUntil('2026-08-05', '2026-12-31', 'monthly', {
      dayOfMonth: 5,
      end: '2026-09-30',
    })
    expect(dates).toEqual(['2026-08-05', '2026-09-05'])
  })

  it('ne renvoie rien si le début dépasse la limite', () => {
    expect(occurrencesUntil('2027-01-01', '2026-12-31', 'monthly')).toEqual([])
  })

  it('renvoie une seule date pour une opération ponctuelle', () => {
    expect(occurrencesUntil('2026-08-05', '2026-12-31', 'one_off')).toEqual(['2026-08-05'])
  })

  it('respecte la limite de sécurité', () => {
    // Une récurrence hebdomadaire sur dix ans ne doit pas produire 520 lignes.
    const dates = occurrencesUntil('2026-01-01', '2036-01-01', 'weekly', { limit: 10 })
    expect(dates).toHaveLength(10)
  })
})
