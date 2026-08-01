import { describe, expect, it } from 'vitest'

import {
  detectDateOrder,
  excelSerialToIso,
  parseDate,
} from '@/lib/banking/parse-date'

describe('parseDate', () => {
  it('traite les exemples du cahier des charges', () => {
    // §9 étape 2
    expect(parseDate('12/07/2026', 'dmy')).toBe('2026-07-12')
    expect(parseDate('2026-07-12')).toBe('2026-07-12')
  })

  it('accepte les séparateurs courants', () => {
    expect(parseDate('12/07/2026', 'dmy')).toBe('2026-07-12')
    expect(parseDate('12-07-2026', 'dmy')).toBe('2026-07-12')
    expect(parseDate('12.07.2026', 'dmy')).toBe('2026-07-12')
  })

  it('complète les années à deux chiffres', () => {
    expect(parseDate('12/07/26', 'dmy')).toBe('2026-07-12')
    expect(parseDate('12/07/98', 'dmy')).toBe('1998-07-12')
  })

  it('respecte l’ordre demandé', () => {
    expect(parseDate('03/04/2026', 'dmy')).toBe('2026-04-03')
    expect(parseDate('03/04/2026', 'mdy')).toBe('2026-03-04')
  })

  it('reconnaît l’ordre année-mois-jour même sans tiret', () => {
    expect(parseDate('2026/07/12')).toBe('2026-07-12')
  })

  it('ignore l’heure qui suit une date ISO', () => {
    expect(parseDate('2026-07-12T14:30:00')).toBe('2026-07-12')
    expect(parseDate('2026-07-12 14:30')).toBe('2026-07-12')
  })

  it('rejette les dates impossibles', () => {
    expect(parseDate('32/01/2026', 'dmy')).toBeNull()
    expect(parseDate('31/02/2026', 'dmy')).toBeNull() // février n'a pas 31 jours
    expect(parseDate('12/13/2026', 'dmy')).toBeNull() // mois 13
    expect(parseDate('2026-02-30')).toBeNull()
  })

  it('accepte le 29 février d’une année bissextile', () => {
    expect(parseDate('29/02/2028', 'dmy')).toBe('2028-02-29')
    expect(parseDate('29/02/2026', 'dmy')).toBeNull()
  })

  it('rejette les valeurs vides ou non datées', () => {
    expect(parseDate('')).toBeNull()
    expect(parseDate('   ')).toBeNull()
    expect(parseDate('libellé')).toBeNull()
    expect(parseDate('12/07')).toBeNull()
  })
})

describe('excelSerialToIso', () => {
  it('convertit les numéros de série Excel', () => {
    // 1er janvier 2026 = 46023 dans le calendrier Excel.
    expect(excelSerialToIso(46023)).toBe('2026-01-01')
    expect(excelSerialToIso(1)).toBe('1899-12-31')
  })

  it('rejette les valeurs aberrantes', () => {
    expect(excelSerialToIso(0)).toBeNull()
    expect(excelSerialToIso(-5)).toBeNull()
    expect(excelSerialToIso(Number.NaN)).toBeNull()
  })

  it('est utilisé par parseDate sur une colonne mal typée', () => {
    expect(parseDate('46023')).toBe('2026-01-01')
    // Un petit nombre n'est pas une date : c'est probablement un montant.
    expect(parseDate('4589')).toBeNull()
  })
})

describe('detectDateOrder', () => {
  it('prouve le format français dès qu’un jour dépasse 12', () => {
    const result = detectDateOrder(['03/04/2026', '25/04/2026', '01/05/2026'])
    expect(result.order).toBe('dmy')
    expect(result.certain).toBe(true)
  })

  it('prouve le format américain dès qu’un mois dépasse 12', () => {
    const result = detectDateOrder(['04/03/2026', '04/25/2026'])
    expect(result.order).toBe('mdy')
    expect(result.certain).toBe(true)
  })

  it('reconnaît l’ordre ISO', () => {
    const result = detectDateOrder(['2026-04-03', '2026-04-25'])
    expect(result.order).toBe('ymd')
    expect(result.certain).toBe(true)
  })

  it('retombe sur le format français sans preuve, en le signalant', () => {
    // Toutes les valeurs sont ambiguës : 03/04 peut être lu dans les deux sens.
    const result = detectDateOrder(['03/04/2026', '05/06/2026'])
    expect(result.order).toBe('dmy')
    expect(result.certain).toBe(false)
  })

  it('compte les valeurs inexploitables', () => {
    const result = detectDateOrder(['12/07/2026', 'Date', '', 'n/a'])
    expect(result.unparsed).toBe(2) // « Date » et « n/a », la chaîne vide ne compte pas
  })

  it('ne tranche pas sur des preuves contradictoires', () => {
    // Un fichier mélangeant les deux formats est suspect : on reste prudent.
    const result = detectDateOrder(['25/04/2026', '04/25/2026'])
    expect(result.certain).toBe(false)
  })
})
