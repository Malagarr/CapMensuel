import { describe, expect, it } from 'vitest'

import { DELETE_ACCOUNT_CONFIRMATION, deleteAccountSchema } from '@/lib/validation/profile'

describe('deleteAccountSchema', () => {
  it('accepte la phrase de confirmation exacte', () => {
    const result = deleteAccountSchema.safeParse({ confirmation: DELETE_ACCOUNT_CONFIRMATION })
    expect(result.success).toBe(true)
  })

  it('tolère la casse et les espaces autour de la saisie', () => {
    expect(deleteAccountSchema.safeParse({ confirmation: '  Supprimer  ' }).success).toBe(true)
    expect(deleteAccountSchema.safeParse({ confirmation: 'SUPPRIMER' }).success).toBe(true)
    expect(deleteAccountSchema.safeParse({ confirmation: '  supprimer  ' }).success).toBe(true)
  })

  it('refuse toute autre saisie', () => {
    expect(deleteAccountSchema.safeParse({ confirmation: '' }).success).toBe(false)
    expect(deleteAccountSchema.safeParse({ confirmation: 'oui' }).success).toBe(false)
    expect(deleteAccountSchema.safeParse({ confirmation: 'supprimer mon compte' }).success).toBe(
      false,
    )
  })
})
