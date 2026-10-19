import { useI18n } from 'vue-i18n'
import { applyLocale, type AppLocale } from '../i18n'

export function useLocale() {
  const { locale, t } = useI18n()

  const setLocale = (newLocale: AppLocale) => {
    locale.value = newLocale
    applyLocale(newLocale)
  }

  const toggleLocale = () => setLocale(locale.value === 'en' ? 'ar' : 'en')

  return { locale, toggleLocale, setLocale, t }
}
