export interface Category {
  id: number
  title: string
  date_created: string
}

export interface EventList {
  id: number
  title: string
  category: number | Category
}

export type Priority = 'low' | 'medium' | 'high'

export interface EventItem {
  id: number
  title: string
  description: string
  event_list: number | EventList
  planned_date: string
  priroty: Priority // Changed from 'priority' to match your API
  notified: boolean
}

// Optional UI type for FullCalendar mapping
export interface CalendarEventInput {
  id: string
  title: string
  start: Date | string
  end?: Date | string
  backgroundColor?: string
  borderColor?: string
  editable?: boolean
  extendedProps?: Record<string, unknown>
}
