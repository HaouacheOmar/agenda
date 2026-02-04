const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

class ApiService {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      // Handle 204 No Content (delete success)
      if (response.status === 204) {
        return {} as T
      }

      const data = await response.json()

      if (!response.ok) {
        // Handle Django error responses
        const errorMessage = data.err || data.error || data.message || `HTTP ${response.status}`
        throw new Error(errorMessage)
      }

      return data
    } catch (error) {
      console.error(`API Error: ${endpoint}`, error)
      throw error
    }
  }

  // Event Lists endpoints
  async getEventLists() {
    return this.request('/event/eventlists/')
  }

  async createEventList(data: any) {
    return this.request('/event/eventlists/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Events endpoints
  async getEvents() {
    return this.request('/event/events/')
  }

  async createEvent(data: any) {
    return this.request('/event/events/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getEventById(pk: number) {
    return this.request(`/event/events/${pk}`)
  }

  async updateEvent(pk: number, data: any) {
    return this.request(`/event/events/${pk}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteEvent(pk: number) {
    return this.request(`/event/events/${pk}`, {
      method: 'DELETE',
    })
  }

  // Events by priority
  async getEventsByPriority(priority: string) {
    return this.request(`/event/events/priority/?priority=${priority}`)
  }

  async getEventsByEventList(eventListId: number) {
    return this.request(`/event/events/eventlist/${eventListId}`)
  }

  async getCategories() {
    return this.request('/category/categories/')
  }

  async createCategory(data: any) {
    return this.request('/category/categories/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteCategory(pk: number) {
    return this.request(`/category/categories/${pk}`, {
      method: 'DELETE',
    })
  }
}

export default new ApiService()
