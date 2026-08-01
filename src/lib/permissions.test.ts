import { describe, expect, it } from 'vitest'

import { canManageHousehold, canWrite } from '@/lib/permissions'

describe('canWrite', () => {
  it('autorise les administrateurs et les membres', () => {
    expect(canWrite('admin')).toBe(true)
    expect(canWrite('member')).toBe(true)
  })

  it('refuse les lecteurs et l’absence de rôle', () => {
    expect(canWrite('viewer')).toBe(false)
    expect(canWrite(null)).toBe(false)
    expect(canWrite(undefined)).toBe(false)
  })
})

describe('canManageHousehold', () => {
  it('n’autorise que les administrateurs', () => {
    expect(canManageHousehold('admin')).toBe(true)
    expect(canManageHousehold('member')).toBe(false)
    expect(canManageHousehold('viewer')).toBe(false)
    expect(canManageHousehold(null)).toBe(false)
  })
})
