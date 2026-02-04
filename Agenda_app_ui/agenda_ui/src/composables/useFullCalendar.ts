// src/composables/useFullCalendar.ts
import { ref, computed } from 'vue'
import type { EventItem } from '../types/agenda'
import type { EventInput } from '@fullcalendar/core'

export function useFullCalendar(items: EventItem[]) {
const events = computed<EventInput[]>(() =>
  items.map(item => ({
    title: item.title,
    start: item.planned_date,
    backgroundColor: '#3b82f6',
    extendedProps: {
      description: item.description,
      priority: item.priroty,
      eventList: item.event_list,
      notified: item.notified
    }
  }))
)

  return { events }
}