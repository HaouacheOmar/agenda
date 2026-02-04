import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export function useLocale() {
  const { locale, t } = useI18n()

  const currentLocale = computed(() => locale.value)
  const isRTL = computed(() => locale.value === 'ar')

  const toggleLocale = () => {
    locale.value = locale.value === 'en' ? 'ar' : 'en'
    localStorage.setItem('locale', locale.value)
    document.documentElement.setAttribute('dir', isRTL.value ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', locale.value)
  }

  const setLocale = (newLocale: 'en' | 'ar') => {
    locale.value = newLocale
    localStorage.setItem('locale', newLocale)
    document.documentElement.setAttribute('dir', newLocale === 'ar' ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', newLocale)
  }

  return {
    locale: currentLocale,
    isRTL,
    toggleLocale,
    setLocale,
    t
  }
}