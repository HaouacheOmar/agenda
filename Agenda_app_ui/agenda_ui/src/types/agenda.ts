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
  start_date: string
  end_date: string
  priroty: Priority // spelled like the Django model field
  notified: boolean
}

export const PRIORITIES: Priority[] = ['low', 'medium', 'high']

// Single source for priority colors and how many days ahead to notify.
export const PRIORITY_META: Record<Priority, { color: string; notifyDays: number }> = {
  high: { color: '#ef4444', notifyDays: 3 },
  medium: { color: '#f59e0b', notifyDays: 2 },
  low: { color: '#10b981', notifyDays: 1 },
}

export const idOf = (ref: number | { id: number }) => (typeof ref === 'number' ? ref : ref.id)

// ISO string from the API -> value for <input type="datetime-local"> (local time, no zone).
export const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// <input type="datetime-local"> value -> ISO string with zone, so Django doesn't treat it as UTC.
export const toIso = (local: string) => new Date(local).toISOString()
