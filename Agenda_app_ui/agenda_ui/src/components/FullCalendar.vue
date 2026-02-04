<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import arLocale from '@fullcalendar/core/locales/ar'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CalendarOptions, EventInput } from '@fullcalendar/core'
import type { EventItem } from '../types/agenda'
import '../styles/FullCalendar.css'

const { locale, t } = useI18n()

// Algerian Arabic locale for FullCalendar
const arDZLocale: any = {
  code: 'ar-dz',
  week: {
    dow: 0,
    doy: 6,
  },
  buttonText: {
    prev: 'السابق',
    next: 'التالي',
    prevYear: 'السنة السابقة',
    nextYear: 'السنة التالية',
    today: 'اليوم',
    month: 'الشهر',
    week: 'الأسبوع',
    day: 'اليوم',
    list: 'القائمة',
  },
  weekText: 'ع',
  allDayText: 'اليوم كاملا',
  moreLinkText: function (n: number) {
    return '+' + n
  },
  noEventsText: 'لا توجد أحداث',
  monthNames: [
    'جانفي',
    'فيفري',
    'مارس',
    'أفريل',
    'ماي',
    'جوان',
    'جويليه',
    'أوت',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ],
  monthNamesShort: [
    'جانفي',
    'فيفري',
    'مارس',
    'أفريل',
    'ماي',
    'جوان',
    'جويليه',
    'أوت',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ],
  dayNames: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  dayNamesShort: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
}

interface Props {
  events: EventItem[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  eventClick: [id: number]
  dateClick: [date: Date]
}>()

// Convert EventItem to FullCalendar EventInput
const calendarEvents = computed<EventInput[]>(() =>
  props.events.map((event) => ({
    id: String(event.id),
    title: event.title,
    start: event.planned_date,
    backgroundColor: getPriorityColor(event.priroty),
    borderColor: getPriorityColor(event.priroty),
    extendedProps: {
      description: event.description,
      priority: event.priroty,
      eventList: event.event_list,
      notified: event.notified,
    },
  })),
)

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#10b981',
  }
  return colors[priority] || '#3b82f6'
}

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
  initialView: 'dayGridMonth',
  locale: locale.value === 'ar' ? arDZLocale : 'en',
  direction: locale.value === 'ar' ? 'rtl' : 'ltr',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
  },
  events: calendarEvents.value,
  height: 'auto',
  editable: false,
  selectable: true,
  eventClick: (info) => {
    const id = parseInt(info.event.id)
    emit('eventClick', id)
  },
  dateClick: (info) => {
    emit('dateClick', info.date)
  },
}))
</script>

<template>
  <div class="calendar-container">
    <div v-if="loading" class="loading">{{ t('calendar.loading') }}</div>
    <FullCalendar v-else :options="calendarOptions" />
  </div>
</template>
