import { describe, expect, it } from 'vitest'

import {
  buildFingerprint,
  deburrLower,
  extractMerchant,
  normalizeLabel,
} from '@/lib/banking/normalize'

describe('deburrLower', () => {
  it('retire les accents et met en minuscules', () => {
    expect(deburrLower('ÉLECTRICITÉ')).toBe('electricite')
    expect(deburrLower('Crédit Agricole')).toBe('credit agricole')
    expect(deburrLower('Ça coûte cher')).toBe('ca coute cher')
  })
})

describe('normalizeLabel', () => {
  it('traite l’exemple du cahier des charges', () => {
    // §27 : « CB 2507 INTERMARCHE LESNEVEN 29 CARTE 1234 » -> « intermarché lesneven »
    // (sans accent, puisque la forme normalisée est désaccentuée)
    expect(normalizeLabel('CB 2507 INTERMARCHE LESNEVEN 29 CARTE 1234')).toBe(
      'intermarche lesneven',
    )
  })

  it('produit la même forme pour trois écritures de la même enseigne', () => {
    const variantes = [
      'CB 2507 INTERMARCHE LESNEVEN 29 CARTE 1234',
      'PAIEMENT CB 12/07 INTERMARCHE LESNEVEN',
      'ACHAT CB INTERMARCHE LESNEVEN',
    ]
    const normalisees = variantes.map(normalizeLabel)
    expect(new Set(normalisees).size).toBe(1)
  })

  it('retire les préfixes de type d’opération', () => {
    expect(normalizeLabel('PRELEVEMENT EDF')).toBe('edf')
    expect(normalizeLabel('VIREMENT SEPA SALAIRE')).toBe('salaire')
    expect(normalizeLabel('CHEQUE 0000123')).toBe('')
  })

  it('retire les dates dans plusieurs formats', () => {
    expect(normalizeLabel('NETFLIX 12/07/2026')).toBe('netflix')
    expect(normalizeLabel('NETFLIX 2026-07-12')).toBe('netflix')
    expect(normalizeLabel('NETFLIX 12.07.26')).toBe('netflix')
  })

  it('retire les identifiants techniques et les IBAN', () => {
    expect(normalizeLabel('PRLV SEPA ORANGE FR7630006000011234567890189')).toBe('orange')
    expect(normalizeLabel('EDF REF: 4589231XZ')).toBe('edf')
  })

  it('tolère les libellés vides ou purement techniques', () => {
    expect(normalizeLabel('')).toBe('')
    expect(normalizeLabel('CB')).toBe('')
    expect(normalizeLabel('   ')).toBe('')
  })

  it('conserve les libellés déjà propres', () => {
    expect(normalizeLabel('Loyer appartement')).toBe('loyer appartement')
  })
})

describe('extractMerchant', () => {
  it('garde le premier mot signifiant', () => {
    expect(extractMerchant('intermarche lesneven')).toBe('intermarche')
    expect(extractMerchant('totalenergies station brest')).toBe('totalenergies')
  })

  it('ignore les articles et les mots trop courts', () => {
    expect(extractMerchant('la poste brest')).toBe('poste')
    expect(extractMerchant('e leclerc drive')).toBe('leclerc')
  })

  it('garde deux mots quand le premier est trop générique', () => {
    // « credit » seul confondrait le Crédit Agricole et le Crédit Mutuel.
    expect(extractMerchant('credit agricole brest')).toBe('credit agricole')
    expect(extractMerchant('credit mutuel brest')).toBe('credit mutuel')
  })

  it('ignore les formes juridiques', () => {
    expect(extractMerchant('sarl boulangerie martin')).toBe('boulangerie martin')
  })

  it('renvoie une chaîne vide si rien d’exploitable', () => {
    expect(extractMerchant('')).toBe('')
    expect(extractMerchant('de la')).toBe('')
  })
})

describe('buildFingerprint', () => {
  const base = {
    accountId: '11111111-1111-1111-1111-111111111111',
    date: '2026-07-12',
    amount: -42.5,
    normalizedLabel: 'intermarche lesneven',
  }

  it('est identique pour deux opérations identiques', () => {
    expect(buildFingerprint(base)).toBe(buildFingerprint({ ...base }))
  })

  it('diffère si le montant change d’un centime', () => {
    expect(buildFingerprint(base)).not.toBe(
      buildFingerprint({ ...base, amount: -42.51 }),
    )
  })

  it('diffère si le compte change', () => {
    expect(buildFingerprint(base)).not.toBe(
      buildFingerprint({ ...base, accountId: '22222222-2222-2222-2222-222222222222' }),
    )
  })

  it('diffère si la date change', () => {
    expect(buildFingerprint(base)).not.toBe(
      buildFingerprint({ ...base, date: '2026-07-13' }),
    )
  })

  it('évite les surprises du binaire flottant', () => {
    // 0.1 + 0.2 vaut 0.30000000000000004 en flottant : l'empreinte doit
    // néanmoins être celle de 0.30.
    expect(buildFingerprint({ ...base, amount: 0.1 + 0.2 })).toBe(
      buildFingerprint({ ...base, amount: 0.3 }),
    )
  })
})
