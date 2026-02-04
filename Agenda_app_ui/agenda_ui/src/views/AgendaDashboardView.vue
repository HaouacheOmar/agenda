<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import FullCalendar from '../components/FullCalendar.vue'
import EventListFilter from '../components/EventListFilter.vue'
import CategoryFilter from '../components/CategoryFilter.vue'
import PriorityMeter from '../components/PriorityMeter.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import apiService from '../services/api'
import type { EventItem, EventList, Priority, Category } from '../types/agenda'
import '../styles/AgendaDashboardView.css'

const { t } = useI18n()
const router = useRouter()
const events = ref<EventItem[]>([])
const eventLists = ref<EventList[]>([])
const categories = ref<Category[]>([])
const selectedEventListId = ref<number | null>(null)
const selectedCategoryId = ref<number | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const showAddEventModal = ref(false)
const formSubmitting = ref(false)
const formError = ref<string | null>(null)
const showCategoryModal = ref(false)
const categorySubmitting = ref(false)
const categoryError = ref<string | null>(null)
const showEventListModal = ref(false)
const eventListSubmitting = ref(false)
const eventListError = ref<string | null>(null)
const notifications = ref<Array<{ id: string; title: string; message: string; type: string }>>([])
const notificationTimeout = ref<ReturnType<typeof setInterval> | null>(null)

const newEventForm = ref({
  title: '',
  description: '',
  planned_date: '',
  event_list: '' as '' | number,
  priroty: 'medium' as Priority,
})

const newCategoryForm = ref({
  title: '',
})

const newEventListForm = ref({
  title: '',
  category: '' as '' | number,
})

// Filtered event lists based on selected category
const filteredEventLists = computed(() => {
  if (!selectedCategoryId.value) {
    return eventLists.value
  }
  return eventLists.value.filter((list) => {
    const categoryId = typeof list.category === 'number' ? list.category : list.category.id
    return categoryId === selectedCategoryId.value
  })
})

// Filtered events based on selected list
const filteredEvents = computed(() => {
  if (!selectedEventListId.value) {
    return events.value
  }
  return events.value.filter((event) => {
    const eventListId =
      typeof event.event_list === 'number' ? event.event_list : event.event_list.id
    return eventListId === selectedEventListId.value
  })
})

const highPriorityCount = computed(
  () => filteredEvents.value.filter((e) => e.priroty === 'high').length,
)

const mediumPriorityCount = computed(
  () => filteredEvents.value.filter((e) => e.priroty === 'medium').length,
)

const lowPriorityCount = computed(
  () => filteredEvents.value.filter((e) => e.priroty === 'low').length,
)

const fetchEvents = async () => {
  loading.value = true
  error.value = null
  try {
    events.value = (await apiService.getEvents()) as EventItem[]
    checkUpcomingEvents()
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('dashboard.error')
    console.error('Error fetching events:', err)
  } finally {
    loading.value = false
  }
}

const fetchEventLists = async () => {
  try {
    eventLists.value = (await apiService.getEventLists()) as EventList[]
  } catch (err) {
    console.error('Error fetching event lists:', err)
  }
}

const fetchCategories = async () => {
  try {
    categories.value = (await apiService.getCategories()) as Category[]
  } catch (err) {
    console.error('Error fetching categories:', err)
  }
}

const openAddEventModal = async () => {
  showAddEventModal.value = true
  formError.value = null
  if (!eventLists.value.length) {
    await fetchEventLists()
  }
}

const closeAddEventModal = () => {
  showAddEventModal.value = false
  formError.value = null
  newEventForm.value = {
    title: '',
    description: '',
    planned_date: '',
    event_list: '',
    priroty: 'medium',
  }
}

const handleCreateEvent = async () => {
  if (
    !newEventForm.value.title ||
    !newEventForm.value.planned_date ||
    !newEventForm.value.event_list
  ) {
    formError.value = t('modals.addEvent.error')
    return
  }

  formSubmitting.value = true
  formError.value = null
  try {
    await apiService.createEvent({
      title: newEventForm.value.title,
      description: newEventForm.value.description,
      planned_date: newEventForm.value.planned_date,
      event_list: newEventForm.value.event_list,
      priroty: newEventForm.value.priroty,
      notified: false,
    })

    await fetchEvents()
    closeAddEventModal()
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Failed to create event'
    console.error('Error creating event:', err)
  } finally {
    formSubmitting.value = false
  }
}

const handleEventClick = (eventId: number) => {
  sessionStorage.setItem('eventId', eventId.toString())
  router.push({
    name: 'event-detail',
  })
}

const handleDateClick = (date: Date) => {
  console.log('Date clicked:', date)
}

const openCategoryModal = () => {
  showCategoryModal.value = true
  categoryError.value = null
}

const closeCategoryModal = () => {
  showCategoryModal.value = false
  categoryError.value = null
  newCategoryForm.value = { title: '' }
}

const handleCreateCategory = async () => {
  if (!newCategoryForm.value.title.trim()) {
    categoryError.value = t('modals.addCategory.error')
    return
  }

  categorySubmitting.value = true
  categoryError.value = null
  try {
    await apiService.createCategory({ title: newCategoryForm.value.title })
    await fetchCategories()
    closeCategoryModal()
  } catch (err) {
    categoryError.value = err instanceof Error ? err.message : 'Failed to create category'
  } finally {
    categorySubmitting.value = false
  }
}

const handleDeleteCategory = async (categoryId: number) => {
  if (!confirm('Delete this category?')) return

  try {
    await apiService.deleteCategory(categoryId)
    await fetchCategories()
  } catch (err) {
    console.error('Error deleting category:', err)
  }
}

const openEventListModal = () => {
  showEventListModal.value = true
  eventListError.value = null
}

const closeEventListModal = () => {
  showEventListModal.value = false
  eventListError.value = null
  newEventListForm.value = { title: '', category: '' }
}

const handleCreateEventList = async () => {
  if (!newEventListForm.value.title.trim() || !newEventListForm.value.category) {
    eventListError.value = t('modals.addEventList.error')
    return
  }

  eventListSubmitting.value = true
  eventListError.value = null
  try {
    await apiService.createEventList({
      title: newEventListForm.value.title,
      category: newEventListForm.value.category,
    })
    closeEventListModal()
    await fetchEventLists()
  } catch (err) {
    eventListError.value = err instanceof Error ? err.message : 'Failed to create event list'
  } finally {
    eventListSubmitting.value = false
  }
}

const checkUpcomingEvents = () => {
  events.value.forEach((event) => {
    if (event.notified) return

    const eventDate = new Date(event.planned_date)
    const today = new Date()
    const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    let notifyDays = 0
    let notificationType = ''

    if (event.priroty === 'high') {
      notifyDays = 3
      notificationType = 'high'
    } else if (event.priroty === 'medium') {
      notifyDays = 2
      notificationType = 'medium'
    } else if (event.priroty === 'low') {
      notifyDays = 1
      notificationType = 'low'
    }

    // Show notification if event is within the threshold and not yet notified
    if (daysUntil <= notifyDays && daysUntil > 0) {
      const notificationKey = `notifications.${notificationType}Priority`
      const dayLabel = daysUntil > 1 ? t('notifications.days') : t('notifications.day')
      const message = `${t(notificationKey)} ${daysUntil} ${dayLabel}`
      showNotification(`${event.title}`, message, notificationType)
      // Mark as notified in the backend
      apiService.updateEvent(event.id, { ...event, notified: true }).catch((err) => {
        console.error('Failed to update notified status:', err)
      })
    }
  })
}

const showNotification = (title: string, message: string, type: string) => {
  const id = `${Date.now()}-${Math.random()}`
  notifications.value.push({ id, title, message, type })

  // Play notification sound
  playNotificationSound()

  setTimeout(() => {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }, 20000)

  // Also show browser notification if permitted
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body: message, tag: 'event-notification' })
  }
}

const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  } catch (err) {
    console.error('Failed to play notification sound:', err)
  }
}

const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission()
    } catch (err) {
      console.error('Notification permission denied:', err)
    }
  }
}

onMounted(() => {
  fetchEvents()
  fetchEventLists()
  fetchCategories()
  requestNotificationPermission()

  // Check for upcoming events every hour
  const interval = setInterval(checkUpcomingEvents, 60 * 60 * 1000)
  notificationTimeout.value = interval

  // Cleanup on unmount
  return () => {
    if (notificationTimeout.value) {
      clearInterval(notificationTimeout.value)
    }
  }
})
</script>

<template>
  <main class="dashboard">
    <!-- Notifications Container -->
    <div class="notifications-container">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="['notification', `notification-${notification.type}`]"
      >
        <div class="notification-header">
          <h4>{{ notification.title }}</h4>
        </div>
        <p class="notification-message">{{ notification.message }}</p>
      </div>
    </div>

    <div class="dashboard-header">
      <div>
        <h1>{{ t('dashboard.title') }}</h1>
        <p class="subtitle">{{ t('dashboard.subtitle') }}</p>
      </div>
      <div style="display: flex; gap: 12px; align-items: center">
        <LanguageSwitcher />
        <button class="btn-primary" @click="openAddEventModal">
          + {{ t('dashboard.newEvent') }}
        </button>
        <button class="btn-primary" @click="openEventListModal">
          + {{ t('dashboard.addEventList') }}
        </button>
        <button class="btn-primary" @click="openCategoryModal">
          + {{ t('dashboard.addCategory') }}
        </button>
      </div>
    </div>

    <div v-if="error" class="alert alert-error">
      {{ error }}
      <button @click="fetchEvents" class="btn-retry">{{ t('dashboard.retry') }}</button>
    </div>

    <CategoryFilter v-model="selectedCategoryId" :categories="categories" />

    <EventListFilter v-model="selectedEventListId" :eventLists="filteredEventLists" />

    <div class="calendar-section">
      <FullCalendar
        :events="filteredEvents"
        :loading="loading"
        @event-click="handleEventClick"
        @date-click="handleDateClick"
      />
    </div>

    <div class="stats-section">
      <div class="stat-card total-events">
        <h3>{{ t('dashboard.totalEvents') }}</h3>
        <p class="stat-value">{{ filteredEvents.length }}</p>
      </div>
      <PriorityMeter
        :label="t('dashboard.highPriority')"
        :value="highPriorityCount"
        :total="filteredEvents.length"
        color="#ef4444"
      />
      <PriorityMeter
        :label="t('dashboard.mediumPriority')"
        :value="mediumPriorityCount"
        :total="filteredEvents.length"
        color="#f59e0b"
      />
      <PriorityMeter
        :label="t('dashboard.lowPriority')"
        :value="lowPriorityCount"
        :total="filteredEvents.length"
        color="#10b981"
      />
    </div>

    <div v-if="showAddEventModal" class="modal-overlay" @click="closeAddEventModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>{{ t('modals.addEvent.title') }}</h2>
          <button class="modal-close" @click="closeAddEventModal">×</button>
        </div>

        <div v-if="formError" class="alert alert-error">
          {{ formError }}
        </div>

        <div class="modal-body">
          <label class="form-label">{{ t('modals.addEvent.titleLabel') }}</label>
          <input
            v-model="newEventForm.title"
            type="text"
            class="input"
            :placeholder="t('modals.addEvent.titlePlaceholder')"
          />

          <label class="form-label">{{ t('modals.addEvent.descriptionLabel') }}</label>
          <textarea
            v-model="newEventForm.description"
            class="input textarea"
            rows="3"
            :placeholder="t('modals.addEvent.descriptionPlaceholder')"
          ></textarea>

          <label class="form-label">{{ t('modals.addEvent.plannedDateLabel') }}</label>
          <input v-model="newEventForm.planned_date" type="datetime-local" class="input" />

          <label class="form-label">{{ t('modals.addEvent.eventListLabel') }}</label>
          <select v-model="newEventForm.event_list" class="input">
            <option value="" disabled>{{ t('modals.addEvent.eventListPlaceholder') }}</option>
            <option v-for="list in eventLists" :key="list.id" :value="list.id">
              {{ list.title }}
            </option>
          </select>

          <label class="form-label">{{ t('modals.addEvent.priorityLabel') }}</label>
          <select v-model="newEventForm.priroty" class="input">
            <option value="low">{{ t('priority.low') }}</option>
            <option value="medium">{{ t('priority.medium') }}</option>
            <option value="high">{{ t('priority.high') }}</option>
          </select>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" @click="closeAddEventModal" :disabled="formSubmitting">
            {{ t('modals.addEvent.cancel') }}
          </button>
          <button class="btn-primary" @click="handleCreateEvent" :disabled="formSubmitting">
            {{ formSubmitting ? t('modals.addEvent.saving') : t('modals.addEvent.create') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showCategoryModal" class="modal-overlay" @click="closeCategoryModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>{{ t('modals.addCategory.title') }}</h2>
          <button class="modal-close" @click="closeCategoryModal">×</button>
        </div>

        <div v-if="categoryError" class="alert alert-error">
          {{ categoryError }}
        </div>

        <div class="modal-body">
          <label class="form-label">{{ t('modals.addCategory.titleLabel') }}</label>
          <input
            v-model="newCategoryForm.title"
            type="text"
            class="input"
            :placeholder="t('modals.addCategory.titlePlaceholder')"
          />
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" @click="closeCategoryModal" :disabled="categorySubmitting">
            {{ t('modals.addCategory.cancel') }}
          </button>
          <button class="btn-primary" @click="handleCreateCategory" :disabled="categorySubmitting">
            {{
              categorySubmitting ? t('modals.addCategory.creating') : t('modals.addCategory.create')
            }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showEventListModal" class="modal-overlay" @click="closeEventListModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>{{ t('modals.addEventList.title') }}</h2>
          <button class="modal-close" @click="closeEventListModal">×</button>
        </div>

        <div v-if="eventListError" class="alert alert-error">
          {{ eventListError }}
        </div>

        <div class="modal-body">
          <label class="form-label">{{ t('modals.addEventList.titleLabel') }}</label>
          <input
            v-model="newEventListForm.title"
            type="text"
            class="input"
            :placeholder="t('modals.addEventList.titlePlaceholder')"
          />

          <label class="form-label">{{ t('modals.addEventList.categoryLabel') }}</label>
          <select v-model="newEventListForm.category" class="input">
            <option value="" disabled>{{ t('modals.addEventList.categoryPlaceholder') }}</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.title }}
            </option>
          </select>
        </div>

        <div class="modal-actions">
          <button
            class="btn-secondary"
            @click="closeEventListModal"
            :disabled="eventListSubmitting"
          >
            {{ t('modals.addEventList.cancel') }}
          </button>
          <button
            class="btn-primary"
            @click="handleCreateEventList"
            :disabled="eventListSubmitting"
          >
            {{
              eventListSubmitting
                ? t('modals.addEventList.creating')
                : t('modals.addEventList.create')
            }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
