<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import arDzLocale from '@fullcalendar/core/locales/ar-dz'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CalendarOptions, EventInput } from '@fullcalendar/core'
import type { EventItem } from '../types/agenda'
import '../styles/FullCalendar.css'

const props = withDefaults(defineProps<{ events: EventItem[]; loading?: boolean }>(), { loading: false })
const emit = defineEmits<{ eventClick: [id: number]; dateClick: [date: Date] }>()
const { locale, t } = useI18n()
const calendar = useTemplateRef<InstanceType<typeof FullCalendar>>('calendar')

// Month grid on wide screens, a readable agenda list on phones.
const NARROW = '(max-width: 640px)'
const viewFor = () => (window.matchMedia(NARROW).matches ? 'listMonth' : 'dayGridMonth')

const calendarEvents = computed<EventInput[]>(() =>
  props.events.map((event) => ({
    id: String(event.id),
    title: event.title,
    start: event.start_date,
    end: event.end_date,
    classNames: [`fc-prio-${event.priroty}`],
  })),
)

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, listPlugin, interactionPlugin],
  initialView: viewFor(),
  locale: locale.value === 'ar' ? arDzLocale : 'en',
  direction: locale.value === 'ar' ? 'rtl' : 'ltr',
  headerToolbar: { left: 'title', center: '', right: 'today prev,next' },
  buttonText: { today: t('calendar.today') },
  buttonHints: { today: `${t('calendar.today')} (T)` },
  events: calendarEvents.value,
  height: 'auto',
  fixedWeekCount: false,
  dayMaxEvents: 3,
  displayEventTime: true,
  eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  eventClick: (info) => emit('eventClick', Number(info.event.id)),
  dateClick: (info) => emit('dateClick', info.date),
  windowResize: (arg) => {
    const view = viewFor()
    if (arg.view.type !== view) arg.view.calendar.changeView(view)
  },
}))

const api = () => calendar.value?.getApi()
defineExpose({
  prev: () => api()?.prev(),
  next: () => api()?.next(),
  today: () => api()?.today(),
})
</script>

<template>
  <div class="calendar-container" :aria-busy="loading">
    <p v-if="loading" class="calendar-loading">{{ t('calendar.loading') }}</p>
    <FullCalendar v-else ref="calendar" :options="calendarOptions" />
  </div>
</template>
