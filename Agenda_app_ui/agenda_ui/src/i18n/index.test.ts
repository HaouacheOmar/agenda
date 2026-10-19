import { beforeEach, describe, expect, it } from 'vitest'
import { applyLocale, savedLocale } from './index'
import en from '../locales/en'
import ar from '../locales/ar'

// Flatten { a: { b: 'x' } } into ['a.b'].
const keys = (obj: object, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]))

beforeEach(() => localStorage.clear())

describe('locale files', () => {
  it('have exactly the same keys in English and Arabic', () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort())
  })

  it('have no empty translations', () => {
    for (const [lang, messages] of Object.entries({ en, ar })) {
      const empty = keys(messages).filter((k) => !k.split('.').reduce<any>((o, p) => o[p], messages))
      expect(empty, lang).toEqual([])
    }
  })
})

describe('savedLocale', () => {
  it('defaults to English', () => {
    expect(savedLocale()).toBe('en')
  })

  it('reads a saved Arabic choice', () => {
    localStorage.setItem('locale', 'ar')
    expect(savedLocale()).toBe('ar')
  })

  it('ignores unknown values', () => {
    localStorage.setItem('locale', 'fr')
    expect(savedLocale()).toBe('en')
  })
})

describe('applyLocale', () => {
  it('switches the document to RTL for Arabic and persists it', () => {
    applyLocale('ar')
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    expect(document.documentElement.getAttribute('lang')).toBe('ar')
    expect(localStorage.getItem('locale')).toBe('ar')
  })

  it('switches back to LTR for English', () => {
    applyLocale('ar')
    applyLocale('en')
    expect(document.documentElement.getAttribute('dir')).toBe('ltr')
    expect(document.documentElement.getAttribute('lang')).toBe('en')
  })
})
