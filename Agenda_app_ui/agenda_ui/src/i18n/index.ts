import { createI18n } from 'vue-i18n'
import en from '../locales/en'
import ar from '../locales/ar'

export type AppLocale = 'en' | 'ar'

export const savedLocale = (): AppLocale => (localStorage.getItem('locale') === 'ar' ? 'ar' : 'en')

// Persist the locale and set <html dir/lang> (Arabic is RTL).
export const applyLocale = (locale: AppLocale) => {
  localStorage.setItem('locale', locale)
  document.documentElement.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  document.documentElement.setAttribute('lang', locale)
}

export default createI18n({
  legacy: false,
  locale: savedLocale(),
  fallbackLocale: 'en',
  messages: { en, ar },
})
