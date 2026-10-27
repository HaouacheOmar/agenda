import type { Category, EventItem, EventList } from '../types/agenda'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

type NewEventList = Omit<EventList, 'id' | 'category'> & { category: number }
type EventPayload = Omit<EventItem, 'id' | 'event_list'> & { event_list: number }

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`
  if (!(response.headers.get('content-type') || '').includes('application/json')) {
    return (await response.text()) || fallback
  }
  const data = await response.json()
  if (data.err || data.error || data.message || data.detail) {
    return data.err || data.error || data.message || data.detail
  }
  // DRF validation errors: { field: ["msg", ...] }
  const fieldErrors = Object.entries(data).map(([field, msgs]) => `${field}: ${([] as unknown[]).concat(msgs).join(' ')}`)
  return fieldErrors.join('\n') || fallback
}

async function send(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const isJson = typeof options.body === 'string'
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: isJson ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
  })
  if (!response.ok) {
    const message = await readErrorMessage(response)
    console.error(`API Error: ${endpoint}`, message)
    throw new Error(message)
  }
  return response
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await send(endpoint, options)
  // 204 No Content (delete success)
  return response.status === 204 ? (undefined as T) : response.json()
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) })
const DELETE: RequestInit = { method: 'DELETE' }

export default {
  getEventLists: () => request<EventList[]>('/event/eventlists/'),
  createEventList: (data: NewEventList) => request<EventList>('/event/eventlists/', json('POST', data)),
  deleteEventList: (pk: number) => request<void>(`/event/eventlists/${pk}/`, DELETE),

  getEvents: () => request<EventItem[]>('/event/events/'),
  createEvent: (data: EventPayload) => request<EventItem>('/event/events/', json('POST', data)),
  getEventById: (pk: number) => request<EventItem>(`/event/events/${pk}`),
  updateEvent: (pk: number, data: EventPayload) => request<EventItem>(`/event/events/${pk}`, json('PUT', data)),
  deleteEvent: (pk: number) => request<void>(`/event/events/${pk}`, DELETE),

  getCategories: () => request<Category[]>('/category/categories/'),
  createCategory: (data: Pick<Category, 'title'>) => request<Category>('/category/categories/', json('POST', data)),
  deleteCategory: (pk: number) => request<void>(`/category/categories/${pk}/`, DELETE),

  exportData: async () => (await send('/data/export/')).blob(),
  importData: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return request<{ msg: string; counts: Record<string, number> }>('/data/import/', { method: 'POST', body })
  },
}
