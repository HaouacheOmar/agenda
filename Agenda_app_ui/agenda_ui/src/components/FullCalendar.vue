<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import arDzLocale from '@fullcalendar/core/locales/ar-dz'
import type { CalendarOptions, EventInput } from '@fullcalendar/core'
import { PRIORITY_META } from '../types/agenda'
import type { EventItem } from '../types/agenda'
import '../styles/FullCalendar.css'

const { locale, t } = useI18n()

interface Props {
  events: EventItem[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  eventClick: [id: number]
}>()

const calendarEvents = computed<EventInput[]>(() =>
  props.events.map((event) => ({
    id: String(event.id),
    title: event.title,
    start: event.start_date,
    end: event.end_date,
    backgroundColor: PRIORITY_META[event.priroty].color,
    borderColor: PRIORITY_META[event.priroty].color,
  })),
)

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin],
  initialView: 'dayGridMonth',
  locale: locale.value === 'ar' ? arDzLocale : 'en',
  direction: locale.value === 'ar' ? 'rtl' : 'ltr',
  headerToolbar: {
    left: 'prev',
    center: 'title',
    right: 'next',
  },
  events: calendarEvents.value,
  height: 'auto',
  contentHeight: 'auto',
  editable: false,
  displayEventTime: false,
  fixedWeekCount: true,
  showNonCurrentDates: true,
  eventClick: (info) => emit('eventClick', Number(info.event.id)),
}))
</script>

<template>
  <div class="calendar-container">
    <div v-if="loading" class="loading">{{ t('calendar.loading') }}</div>
    <FullCalendar v-else :options="calendarOptions" />
  </div>
</template>
