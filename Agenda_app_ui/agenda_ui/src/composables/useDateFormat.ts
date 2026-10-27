import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// One formatter set for the whole app, always 24h, so every screen shows dates the same way.
export function useDateFormat() {
  const { locale } = useI18n()
  const code = computed(() => (locale.value === 'ar' ? 'ar-DZ' : 'en-GB'))

  const make = (options: Intl.DateTimeFormatOptions) =>
    computed(() => new Intl.DateTimeFormat(code.value, { hour12: false, ...options }))

  const time = make({ hour: '2-digit', minute: '2-digit' })
  const day = make({ weekday: 'short', day: 'numeric', month: 'short' })
  const full = make({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const range = make({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return {
    formatTime: (iso: string) => time.value.format(new Date(iso)),
    formatDay: (iso: string) => day.value.format(new Date(iso)),
    formatFull: (iso: string) => full.value.format(new Date(iso)),
    // "16 Oct, 18:00–19:00": shared parts are written once. formatRange is ES2021.Intl,
    // typed locally because the project's TS lib stops at ES2020.
    formatRange: (start: string, end: string) =>
      (range.value as Intl.DateTimeFormat & { formatRange(a: Date, b: Date): string }).formatRange(
        new Date(start),
        new Date(end),
      ),
  }
}

/** Whole calendar days from today to the given instant (0 = today, 1 = tomorrow). */
export const daysFromToday = (iso: string, now = new Date()) => {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / 864e5)
}
