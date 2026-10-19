import { describe, expect, it } from 'vitest'
import { PRIORITIES, PRIORITY_META, idOf, toIso, toLocalInput } from './agenda'

describe('idOf', () => {
  it('returns a raw id as is', () => {
    expect(idOf(7)).toBe(7)
  })

  it('unwraps a nested object', () => {
    expect(idOf({ id: 3 })).toBe(3)
  })
})

describe('datetime-local conversion', () => {
  it('shows an API instant as local wall-clock time', () => {
    const local = new Date(2026, 0, 2, 9, 5) // 2 Jan 2026 09:05 in the test machine's zone
    expect(toLocalInput(local.toISOString())).toBe('2026-01-02T09:05')
  })

  it('accepts the "+00:00" offset Django can return', () => {
    const iso = new Date(2026, 5, 15, 18, 30).toISOString().replace('.000Z', '+00:00')
    expect(toLocalInput(iso)).toBe('2026-06-15T18:30')
  })

  it('round-trips without shifting by the timezone offset', () => {
    const iso = '2026-03-29T00:30:00.000Z' // around a DST switch in Europe
    expect(toIso(toLocalInput(iso))).toBe(iso)
  })

  it('sends a local input value as the matching UTC instant', () => {
    expect(new Date(toIso('2026-10-20T10:00')).getTime()).toBe(new Date(2026, 9, 20, 10, 0).getTime())
  })
})

describe('PRIORITY_META', () => {
  it('covers every priority', () => {
    expect(Object.keys(PRIORITY_META).sort()).toEqual([...PRIORITIES].sort())
  })

  it('notifies higher priorities earlier', () => {
    expect(PRIORITY_META.high.notifyDays).toBeGreaterThan(PRIORITY_META.medium.notifyDays)
    expect(PRIORITY_META.medium.notifyDays).toBeGreaterThan(PRIORITY_META.low.notifyDays)
  })
})
