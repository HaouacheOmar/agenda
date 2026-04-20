<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import FullCalendar from '../components/FullCalendar.vue'
import PriorityMeter from '../components/PriorityMeter.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import eventIcon from '../assets/event-edit-svgrepo-com.svg'
import listIcon from '../assets/list-svgrepo-com.svg'
import categoryIcon from '../assets/category-svgrepo-com.svg'
import importDbIcon from '../assets/import-db.svg'
import exportDbIcon from '../assets/export-db.svg'
import apiService from '../services/api'
import type { EventItem, EventList, Priority, Category } from '../types/agenda'
import '../styles/AgendaDashboardView.css'

const { t, locale } = useI18n()
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
const dbTransferLoading = ref(false)
const sqliteImportInput = ref<HTMLInputElement | null>(null)
const notifications = ref<Array<{ id: string; title: string; message: string; type: string }>>([])
const notificationTimeout = ref<ReturnType<typeof setInterval> | null>(null)

const newEventForm = ref({
  title: '',
  description: '',
  start_date: '',
  end_date: '',
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

// Filtered events based on selected category/list relationship
const filteredEvents = computed(() => {
  return events.value.filter((event) => {
    const eventListId = getEventListId(event)

    if (selectedEventListId.value && eventListId !== selectedEventListId.value) {
      return false
    }

    if (selectedCategoryId.value) {
      const eventList = eventLists.value.find((list) => list.id === eventListId)
      if (!eventList) {
        return false
      }
      if (getCategoryId(eventList) !== selectedCategoryId.value) {
        return false
      }
    }

    return true
  })
})

const selectedCategoryValue = computed({
  get: () => (selectedCategoryId.value ? String(selectedCategoryId.value) : ''),
  set: (value: string) => {
    selectedCategoryId.value = value ? parseInt(value) : null
  },
})

const selectedEventListValue = computed({
  get: () => (selectedEventListId.value ? String(selectedEventListId.value) : ''),
  set: (value: string) => {
    selectedEventListId.value = value ? parseInt(value) : null
  },
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
    start_date: '',
    end_date: '',
    event_list: '',
    priroty: 'medium',
  }
}

const handleCreateEvent = async () => {
  if (
    !newEventForm.value.title ||
    !newEventForm.value.start_date ||
    !newEventForm.value.end_date ||
    !newEventForm.value.event_list
  ) {
    formError.value = t('modals.addEvent.error')
    return
  }

  if (new Date(newEventForm.value.end_date) < new Date(newEventForm.value.start_date)) {
    formError.value = t('modals.addEvent.dateOrderError')
    return
  }

  formSubmitting.value = true
  formError.value = null
  try {
    await apiService.createEvent({
      title: newEventForm.value.title,
      description: newEventForm.value.description,
      start_date: newEventForm.value.start_date,
      end_date: newEventForm.value.end_date,
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
  if (!confirm(t('dashboard.confirmDeleteCategory'))) return

  try {
    await apiService.deleteCategory(categoryId)
    if (selectedCategoryId.value === categoryId) {
      selectedCategoryId.value = null
      selectedEventListId.value = null
    }

    await fetchCategories()
    await fetchEventLists()
    await fetchEvents()
  } catch (err) {
    console.error('Error deleting category:', err)
  }
}

const handleDeleteEventList = async (eventListId: number) => {
  if (!confirm(t('dashboard.confirmDeleteEventList'))) return

  try {
    await apiService.deleteEventList(eventListId)
    if (selectedEventListId.value === eventListId) {
      selectedEventListId.value = null
    }

    await fetchEventLists()
    await fetchEvents()
  } catch (err) {
    console.error('Error deleting event list:', err)
  }
}

const buildSQLiteFileName = () => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `agenda-backup-${stamp}.sqlite3`
}

const handleExportSQLite = async () => {
  dbTransferLoading.value = true
  try {
    const blob = await apiService.exportSQLite()
    const downloadUrl = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = downloadUrl
    anchor.download = buildSQLiteFileName()
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(downloadUrl)

    showNotification(t('dashboard.exportDatabase'), t('dashboard.exportDatabaseSuccess'), 'low')
  } catch (err) {
    const message = err instanceof Error ? err.message : t('dashboard.exportDatabaseError')
    showNotification(t('dashboard.exportDatabase'), message, 'high')
  } finally {
    dbTransferLoading.value = false
  }
}

const triggerSQLiteImport = () => {
  sqliteImportInput.value?.click()
}

const handleSQLiteImportSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  if (!confirm(t('dashboard.confirmImportDatabase'))) {
    input.value = ''
    return
  }

  dbTransferLoading.value = true
  try {
    const response = (await apiService.importSQLite(file)) as { msg?: string; backup?: string }

    await fetchCategories()
    await fetchEventLists()
    await fetchEvents()

    const successMessage = response.backup
      ? `${t('dashboard.importDatabaseSuccess')} (${response.backup})`
      : t('dashboard.importDatabaseSuccess')

    showNotification(t('dashboard.importDatabase'), successMessage, 'low')
  } catch (err) {
    const message = err instanceof Error ? err.message : t('dashboard.importDatabaseError')
    showNotification(t('dashboard.importDatabase'), message, 'high')
  } finally {
    input.value = ''
    dbTransferLoading.value = false
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

const getCategoryId = (eventList: EventList) =>
  typeof eventList.category === 'number' ? eventList.category : eventList.category.id

const getEventListId = (eventItem: EventItem) =>
  typeof eventItem.event_list === 'number' ? eventItem.event_list : eventItem.event_list.id

const getPriorityClass = (priority: Priority) => {
  if (priority === 'high') return 'priority-chip-high'
  if (priority === 'medium') return 'priority-chip-medium'
  return 'priority-chip-low'
}

const getEventCellClass = (priority: Priority) => {
  if (priority === 'high') return 'event-node-high-light'
  if (priority === 'medium') return 'event-node-medium-light'
  return 'event-node-low-light'
}

watch(selectedCategoryId, (categoryId) => {
  if (!selectedEventListId.value) {
    return
  }

  const isSelectedListValid = eventLists.value.some((list) => {
    if (list.id !== selectedEventListId.value) {
      return false
    }
    if (!categoryId) {
      return true
    }
    return getCategoryId(list) === categoryId
  })

  if (!isSelectedListValid) {
    selectedEventListId.value = null
  }
})

watch(selectedEventListId, (eventListId) => {
  if (!eventListId) {
    return
  }

  const selectedList = eventLists.value.find((list) => list.id === eventListId)
  if (!selectedList) {
    return
  }

  const linkedCategoryId = getCategoryId(selectedList)
  if (selectedCategoryId.value !== linkedCategoryId) {
    selectedCategoryId.value = linkedCategoryId
  }
})

const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const localeCode = locale.value === 'ar' ? 'ar-DZ' : 'en-GB'

  const formatter = new Intl.DateTimeFormat(localeCode, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return `${formatter.format(start)} - ${formatter.format(end)}`
}

const hierarchyData = computed(() => {
  const visibleCategories = selectedCategoryId.value
    ? categories.value.filter((cat) => cat.id === selectedCategoryId.value)
    : categories.value

  const sortedCategories = [...visibleCategories].sort((a, b) => a.title.localeCompare(b.title))

  return sortedCategories.map((category) => {
    const lists = filteredEventLists.value
      .filter((eventList) => getCategoryId(eventList) === category.id)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((eventList) => {
        const listEvents = filteredEvents.value
          .filter((eventItem) => getEventListId(eventItem) === eventList.id)
          .sort(
            (a, b) =>
              new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
          )

        return {
          ...eventList,
          events: listEvents,
        }
      })

    return {
      ...category,
      eventLists: lists,
    }
  })
})

const checkUpcomingEvents = () => {
  events.value.forEach((event) => {
    if (event.notified) return

    const eventDate = new Date(event.start_date)
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
      </div>
      <div class="header-actions">
        <button class="btn-action btn-solid" @click="openAddEventModal">
          <img :src="eventIcon" alt="Event" class="btn-icon" />
          <span>+ {{ t('dashboard.addEvent') }}</span>
        </button>
        <button class="btn-action btn-outline" @click="openEventListModal">
          <img :src="listIcon" alt="Event List" class="btn-icon" />
          <span>+ {{ t('dashboard.addEventList') }}</span>
        </button>
        <button class="btn-action btn-outline" @click="openCategoryModal">
          <img :src="categoryIcon" alt="Category" class="btn-icon" />
          <span>+ {{ t('dashboard.addCategory') }}</span>
        </button>
        <button class="btn-action btn-outline" :disabled="dbTransferLoading" @click="handleExportSQLite">
          <img :src="exportDbIcon" alt="Export" class="btn-icon" />
          <span>{{ t('dashboard.exportDatabase') }}</span>
        </button>
        <button class="btn-action btn-outline" :disabled="dbTransferLoading" @click="triggerSQLiteImport">
          <img :src="importDbIcon" alt="Import" class="btn-icon" />
          <span>{{ t('dashboard.importDatabase') }}</span>
        </button>
        <input
          ref="sqliteImportInput"
          type="file"
          accept=".sqlite3,.sqlite,.db,application/x-sqlite3"
          class="hidden-file-input"
          @change="handleSQLiteImportSelected"
        />
      </div>
    </div>

    <div class="dashboard-toolbar">
      <div class="linked-filters">
        <div class="filter-field">
          <label for="dashboard-category-filter">{{ t('filter.categoryLabel') }}</label>
          <select id="dashboard-category-filter" v-model="selectedCategoryValue" class="filter-select">
            <option value="">{{ t('filter.allCategories') }}</option>
            <option v-for="cat in categories" :key="cat.id" :value="String(cat.id)">
              {{ cat.title }}
            </option>
          </select>
        </div>

        <div class="filter-field">
          <label for="dashboard-eventlist-filter">{{ t('filter.label') }}</label>
          <select
            id="dashboard-eventlist-filter"
            v-model="selectedEventListValue"
            class="filter-select"
            :disabled="!filteredEventLists.length"
          >
            <option value="">{{ t('filter.allEvents') }}</option>
            <option v-for="list in filteredEventLists" :key="list.id" :value="String(list.id)">
              {{ list.title }}
            </option>
          </select>
        </div>
      </div>

      <LanguageSwitcher />
    </div>

    <div v-if="error" class="alert alert-error">
      {{ error }}
      <button @click="fetchEvents" class="btn-retry">{{ t('dashboard.retry') }}</button>
    </div>

    <div class="calendar-section">
      <FullCalendar
        :events="filteredEvents"
        :loading="loading"
        @event-click="handleEventClick"
        @date-click="handleDateClick"
      />
    </div>

    <section class="hierarchy-section">
      <h2>{{ t('dashboard.hierarchyTitle') }}</h2>

      <div v-if="!hierarchyData.length" class="hierarchy-empty">
        {{ t('dashboard.hierarchyEmpty') }}
      </div>

      <ul v-else class="category-tree">
        <li v-for="category in hierarchyData" :key="category.id" class="category-node">
          <div class="category-node-header">
            <h3>{{ category.title }}</h3>
            <div class="node-actions">
              <button
                class="btn-node-delete"
                type="button"
                @click.stop="handleDeleteCategory(category.id)"
              >
                {{ t('dashboard.deleteCategory') }}
              </button>
              <span class="category-node-arrow">›</span>
            </div>
          </div>

          <ul class="event-list-tree">
            <li
              v-for="eventList in category.eventLists"
              :key="eventList.id"
              class="event-list-node"
            >
              <div class="event-list-header">
                <h4>{{ eventList.title }}</h4>
                <button
                  class="btn-node-delete"
                  type="button"
                  @click.stop="handleDeleteEventList(eventList.id)"
                >
                  {{ t('dashboard.deleteEventList') }}
                </button>
              </div>

              <p v-if="!eventList.events.length" class="tree-empty">
                {{ t('dashboard.noEventsInEventList') }}
              </p>

              <ul v-else class="event-tree">
                <li
                  v-for="eventItem in eventList.events"
                  :key="eventItem.id"
                  :class="['event-node', getEventCellClass(eventItem.priroty)]"
                  @click="handleEventClick(eventItem.id)"
                >
                  <div class="event-node-main">
                    <span class="event-node-title">{{ eventItem.title }}</span>
                    <span :class="['priority-chip', getPriorityClass(eventItem.priroty)]">
                      {{ t('priority.' + eventItem.priroty) }}
                    </span>
                  </div>
                  <p class="event-node-dates">
                    {{ formatDateRange(eventItem.start_date, eventItem.end_date) }}
                  </p>
                </li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </section>

    <div class="stats-section">
      <div class="stat-card">
        <PriorityMeter
          :label="t('dashboard.totalEvents')"
          :value="filteredEvents.length"
          :total="filteredEvents.length > 0 ? filteredEvents.length : 1"
          color="#3b82f6"
        />
      </div>
      <div class="stat-card">
        <PriorityMeter
          :label="t('dashboard.highPriority')"
          :value="highPriorityCount"
          :total="filteredEvents.length"
          color="#ef4444"
        />
      </div>
      <div class="stat-card">
        <PriorityMeter
          :label="t('dashboard.mediumPriority')"
          :value="mediumPriorityCount"
          :total="filteredEvents.length"
          color="#f59e0b"
        />
      </div>
      <div class="stat-card">
        <PriorityMeter
          :label="t('dashboard.lowPriority')"
          :value="lowPriorityCount"
          :total="filteredEvents.length"
          color="#10b981"
        />
      </div>
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

          <label class="form-label">{{ t('modals.addEvent.startDateLabel') }}</label>
          <input v-model="newEventForm.start_date" type="datetime-local" class="input" />

          <label class="form-label">{{ t('modals.addEvent.endDateLabel') }}</label>
          <input v-model="newEventForm.end_date" type="datetime-local" class="input" />

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
