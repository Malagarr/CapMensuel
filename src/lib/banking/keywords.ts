import type { CategoryKind } from '@/types/database'

/**
 * Dictionnaire de commerçants connus (§10).
 *
 * Il ne cite que des enseignes très répandues en France, associées au nom de la
 * catégorie par défaut créée à l'ouverture d'un foyer. Si l'utilisateur a
 * renommé ou supprimé la catégorie, la règle ne s'applique simplement pas.
 *
 * Ce dictionnaire est volontairement modeste : il sert d'amorçage. La vraie
 * précision vient des règles de l'utilisateur et de la mémoire de ses
 * corrections, qui priment sur lui.
 */

export type KeywordRule = {
  /** Fragments recherchés dans le libellé normalisé (sans accent, en minuscules). */
  patterns: string[]
  /** Nom de la catégorie par défaut visée. */
  categoryName: string
  /** Nature attendue, pour éviter de classer un revenu dans une dépense. */
  kind: CategoryKind
}

export const KEYWORD_RULES: KeywordRule[] = [
  // Alimentation
  {
    patterns: [
      'intermarche',
      'leclerc',
      'carrefour',
      'super u',
      'hyper u',
      'auchan',
      'lidl',
      'aldi',
      'casino',
      'monoprix',
      'franprix',
      'picard',
      'grand frais',
      'biocoop',
      'boulangerie',
      'boucherie',
    ],
    categoryName: 'Alimentation',
    kind: 'variable_expense',
  },

  // Restaurants
  {
    patterns: ['mcdonald', 'burger king', 'kfc', 'quick', 'subway', 'restaurant', 'brasserie', 'uber eats', 'deliveroo', 'just eat'],
    categoryName: 'Restaurants',
    kind: 'variable_expense',
  },

  // Carburant
  {
    patterns: ['totalenergies', 'total access', 'esso', 'bp ', 'shell', 'avia', 'station service', 'carburant'],
    categoryName: 'Carburant',
    kind: 'variable_expense',
  },

  // Électricité
  {
    patterns: ['edf', 'engie electricite', 'total direct energie', 'ekwateur', 'enercoop'],
    categoryName: 'Électricité',
    kind: 'fixed_expense',
  },

  // Gaz
  { patterns: ['engie gaz', 'grdf', 'butagaz', 'antargaz'], categoryName: 'Gaz', kind: 'fixed_expense' },

  // Eau
  { patterns: ['veolia', 'suez', 'saur', 'eau du'], categoryName: 'Eau', kind: 'fixed_expense' },

  // Téléphone et internet
  {
    patterns: ['orange', 'sfr', 'bouygues telecom', 'free mobile', 'sosh', 'red by sfr'],
    categoryName: 'Téléphone',
    kind: 'fixed_expense',
  },
  { patterns: ['free ', 'freebox', 'bouygues box'], categoryName: 'Internet', kind: 'fixed_expense' },

  // Abonnements
  {
    patterns: ['netflix', 'spotify', 'disney', 'canal plus', 'amazon prime', 'deezer', 'apple com bill', 'youtube premium'],
    categoryName: 'Abonnements',
    kind: 'fixed_expense',
  },

  // Assurances
  {
    patterns: ['maif', 'macif', 'matmut', 'axa', 'allianz', 'groupama', 'mma ', 'gmf', 'assurance', 'mutuelle'],
    categoryName: 'Assurances',
    kind: 'fixed_expense',
  },

  // Santé
  {
    patterns: ['pharmacie', 'docteur', 'cabinet medical', 'laboratoire', 'dentiste', 'opticien', 'cpam', 'hopital', 'clinique'],
    categoryName: 'Santé',
    kind: 'variable_expense',
  },

  // Transport
  {
    patterns: ['sncf', 'ratp', 'blablacar', 'uber', 'taxi', 'peage', 'vinci autoroutes', 'aprr'],
    categoryName: 'Transport',
    kind: 'variable_expense',
  },

  // Véhicule
  {
    patterns: ['norauto', 'feu vert', 'midas', 'garage', 'controle technique', 'speedy'],
    categoryName: 'Véhicule',
    kind: 'variable_expense',
  },

  // Loisirs
  {
    patterns: ['fnac', 'cultura', 'decathlon', 'cinema', 'ugc', 'pathe', 'gaumont', 'steam', 'playstation', 'nintendo'],
    categoryName: 'Loisirs',
    kind: 'variable_expense',
  },

  // Vêtements
  {
    patterns: ['zara', 'h m', 'kiabi', 'uniqlo', 'celio', 'jules ', 'chaussures', 'vinted'],
    categoryName: 'Vêtements',
    kind: 'variable_expense',
  },

  // Enfants
  { patterns: ['creche', 'cantine', 'periscolaire', 'caf '], categoryName: 'Enfants', kind: 'variable_expense' },

  // Animaux
  { patterns: ['veterinaire', 'animalerie', 'maxi zoo'], categoryName: 'Animaux', kind: 'variable_expense' },

  // Impôts
  { patterns: ['dgfip', 'impots', 'tresor public', 'finances publiques'], categoryName: 'Impôts', kind: 'fixed_expense' },

  // Loyer et crédit
  { patterns: ['loyer'], categoryName: 'Loyer', kind: 'fixed_expense' },
  { patterns: ['pret immobilier', 'credit immobilier', 'echeance pret'], categoryName: 'Prêt immobilier', kind: 'fixed_expense' },

  // Revenus
  { patterns: ['salaire', 'paie', 'remuneration', 'traitement'], categoryName: 'Salaire', kind: 'income' },
  { patterns: ['caf ', 'allocation', 'pole emploi', 'france travail'], categoryName: 'Allocation', kind: 'income' },
  { patterns: ['retraite', 'pension', 'carsat'], categoryName: 'Pension', kind: 'income' },
  { patterns: ['remboursement', 'ameli', 'secu'], categoryName: 'Remboursement', kind: 'income' },

  // Épargne
  { patterns: ['livret a', 'ldds', 'pel ', 'versement epargne'], categoryName: 'Épargne', kind: 'savings' },
]
