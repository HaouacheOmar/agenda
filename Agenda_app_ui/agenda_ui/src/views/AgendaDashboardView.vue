<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
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
import { PRIORITIES, PRIORITY_META, idOf, toIso } from '../types/agenda'
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
const notifications = ref<Array<{ id: string; title: string; message: string; type: Priority }>>([])
let upcomingCheckInterval: ReturnType<typeof setInterval> | undefined

const emptyEventForm = () => ({
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  event_list: '' as '' | number,
  priroty: 'medium' as Priority,
})
const newEventForm = ref(emptyEventForm())
const newCategoryForm = ref({ title: '' })
const newEventListForm = ref({ title: '', category: '' as '' | number })

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : t('common.error'))
const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title)

const filteredEventLists = computed(() =>
  selectedCategoryId.value
    ? eventLists.value.filter((list) => idOf(list.category) === selectedCategoryId.value)
    : eventLists.value,
)

const filteredEvents = computed(() => {
  if (!selectedEventListId.value && !selectedCategoryId.value) return events.value
  const visibleListIds = new Set(
    filteredEventLists.value
      .filter((list) => !selectedEventListId.value || list.id === selectedEventListId.value)
      .map((list) => list.id),
  )
  return events.value.filter((event) => visibleListIds.has(idOf(event.event_list)))
})

// <select> values are strings; the filter state is number | null.
const numericSelect = (source: typeof selectedCategoryId) =>
  computed({
    get: () => (source.value ? String(source.value) : ''),
    set: (value: string) => {
      source.value = value ? Number(value) : null
    },
  })
const selectedCategoryValue = numericSelect(selectedCategoryId)
const selectedEventListValue = numericSelect(selectedEventListId)

const priorityCounts = computed(() => {
  const counts: Record<Priority, number> = { low: 0, medium: 0, high: 0 }
  filteredEvents.value.forEach((e) => counts[e.priroty]++)
  return counts
})

const fetchEvents = async () => {
  loading.value = true
  error.value = null
  try {
    events.value = await apiService.getEvents()
    checkUpcomingEvents()
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('dashboard.error')
  } finally {
    loading.value = false
  }
}

const fetchEventLists = async () => {
  try {
    eventLists.value = await apiService.getEventLists()
  } catch (err) {
    console.error('Error fetching event lists:', err)
  }
}

const fetchCategories = async () => {
  try {
    categories.value = await apiService.getCategories()
  } catch (err) {
    console.error('Error fetching categories:', err)
  }
}

const fetchAll = () => Promise.all([fetchCategories(), fetchEventLists(), fetchEvents()])

const openAddEventModal = () => {
  showAddEventModal.value = true
  formError.value = null
}

const closeAddEventModal = () => {
  showAddEventModal.value = false
  formError.value = null
  newEventForm.value = emptyEventForm()
}

const handleCreateEvent = async () => {
  const form = newEventForm.value
  if (!form.title || !form.start_date || !form.end_date || !form.event_list) {
    formError.value = t('modals.addEvent.error')
    return
  }

  if (new Date(form.end_date) < new Date(form.start_date)) {
    formError.value = t('modals.addEvent.dateOrderError')
    return
  }

  formSubmitting.value = true
  formError.value = null
  try {
    await apiService.createEvent({
      ...form,
      event_list: form.event_list,
      start_date: toIso(form.start_date),
      end_date: toIso(form.end_date),
      notified: false,
    })
    await fetchEvents()
    closeAddEventModal()
  } catch (err) {
    formError.value = errorMessage(err)
  } finally {
    formSubmitting.value = false
  }
}

const handleEventClick = (eventId: number) => {
  router.push({ name: 'event-detail', params: { id: eventId } })
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
    categoryError.value = errorMessage(err)
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
    await fetchAll()
  } catch (err) {
    showNotification(t('dashboard.deleteCategory'), errorMessage(err), 'high')
  }
}

const handleDeleteEventList = async (eventListId: number) => {
  if (!confirm(t('dashboard.confirmDeleteEventList'))) return

  try {
    await apiService.deleteEventList(eventListId)
    if (selectedEventListId.value === eventListId) {
      selectedEventListId.value = null
    }
    await Promise.all([fetchEventLists(), fetchEvents()])
  } catch (err) {
    showNotification(t('dashboard.deleteEventList'), errorMessage(err), 'high')
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
    const downloadUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = downloadUrl
    anchor.download = buildSQLiteFileName()
    anchor.click()
    URL.revokeObjectURL(downloadUrl)

    showNotification(t('dashboard.exportDatabase'), t('dashboard.exportDatabaseSuccess'), 'low')
  } catch (err) {
    const message = err instanceof Error ? err.message : t('dashboard.exportDatabaseError')
    showNotification(t('dashboard.exportDatabase'), message, 'high')
  } finally {
    dbTransferLoading.value = false
  }
}

const handleSQLiteImportSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!confirm(t('dashboard.confirmImportDatabase'))) {
    input.value = ''
    return
  }

  dbTransferLoading.value = true
  try {
    const response = await apiService.importSQLite(file)
    await fetchAll()

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
  const { title, category } = newEventListForm.value
  if (!title.trim() || !category) {
    eventListError.value = t('modals.addEventList.error')
    return
  }

  eventListSubmitting.value = true
  eventListError.value = null
  try {
    await apiService.createEventList({ title, category })
    closeEventListModal()
    await fetchEventLists()
  } catch (err) {
    eventListError.value = errorMessage(err)
  } finally {
    eventListSubmitting.value = false
  }
}

// Keep the two filters consistent: a list filter must belong to the selected category,
// and picking a list selects its category.
watch(selectedCategoryId, (categoryId) => {
  const list = eventLists.value.find((l) => l.id === selectedEventListId.value)
  if (list && categoryId && idOf(list.category) !== categoryId) {
    selectedEventListId.value = null
  }
})

watch(selectedEventListId, (eventListId) => {
  const list = eventLists.value.find((l) => l.id === eventListId)
  if (list) selectedCategoryId.value = idOf(list.category)
})

const dateRangeFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-DZ' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
)

const formatDateRange = (startDate: string, endDate: string) =>
  `${dateRangeFormatter.value.format(new Date(startDate))} - ${dateRangeFormatter.value.format(new Date(endDate))}`

const hierarchyData = computed(() => {
  const visibleCategories = selectedCategoryId.value
    ? categories.value.filter((cat) => cat.id === selectedCategoryId.value)
    : categories.value

  return [...visibleCategories].sort(byTitle).map((category) => ({
    ...category,
    eventLists: filteredEventLists.value
      .filter((eventList) => idOf(eventList.category) === category.id)
      .sort(byTitle)
      .map((eventList) => ({
        ...eventList,
        events: filteredEvents.value
          .filter((eventItem) => idOf(eventItem.event_list) === eventList.id)
          .sort((a, b) => a.start_date.localeCompare(b.start_date)),
      })),
  }))
})

const DAY_MS = 24 * 60 * 60 * 1000

const checkUpcomingEvents = () => {
  const now = Date.now()
  events.value.forEach((event) => {
    if (event.notified) return

    const daysUntil = Math.ceil((new Date(event.start_date).getTime() - now) / DAY_MS)
    if (daysUntil <= 0 || daysUntil > PRIORITY_META[event.priroty].notifyDays) return

    const dayLabel = daysUntil > 1 ? t('notifications.days') : t('notifications.day')
    showNotification(
      event.title,
      `${t(`notifications.${event.priroty}Priority`)} ${daysUntil} ${dayLabel}`,
      event.priroty,
    )
    // Mark locally too, so the hourly re-check doesn't notify again.
    event.notified = true
    apiService
      .updateEvent(event.id, { ...event, event_list: idOf(event.event_list) })
      .catch((err) => console.error('Failed to update notified status:', err))
  })
}

const showNotification = (title: string, message: string, type: Priority) => {
  const id = `${Date.now()}-${Math.random()}`
  notifications.value.push({ id, title, message, type })
  playNotificationSound()

  setTimeout(() => {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }, 20000)

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body: message, tag: 'event-notification' })
  }
}

let audioContext: AudioContext | undefined

const playNotificationSound = () => {
  try {
    audioContext ??= new AudioContext()
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

onMounted(() => {
  fetchAll()
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
  upcomingCheckInterval = setInterval(checkUpcomingEvents, 60 * 60 * 1000)
})

onUnmounted(() => clearInterval(upcomingCheckInterval))
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
          <img :src="eventIcon" alt="" class="btn-icon" />
          <span>+ {{ t('dashboard.addEvent') }}</span>
        </button>
        <button class="btn-action btn-outline" @click="openEventListModal">
          <img :src="listIcon" alt="" class="btn-icon" />
          <span>+ {{ t('dashboard.addEventList') }}</span>
        </button>
        <button class="btn-action btn-outline" @click="openCategoryModal">
          <img :src="categoryIcon" alt="" class="btn-icon" />
          <span>+ {{ t('dashboard.addCategory') }}</span>
        </button>
        <button class="btn-action btn-outline" :disabled="dbTransferLoading" @click="handleExportSQLite">
          <img :src="exportDbIcon" alt="" class="btn-icon" />
          <span>{{ t('dashboard.exportDatabase') }}</span>
        </button>
        <button class="btn-action btn-outline" :disabled="dbTransferLoading" @click="sqliteImportInput?.click()">
          <img :src="importDbIcon" alt="" class="btn-icon" />
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
                  :class="['event-node', `event-node-${eventItem.priroty}-light`]"
                  @click="handleEventClick(eventItem.id)"
                >
                  <div class="event-node-main">
                    <span class="event-node-title">{{ eventItem.title }}</span>
                    <span :class="['priority-chip', `priority-chip-${eventItem.priroty}`]">
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
        <PriorityMeter :label="t('dashboard.totalEvents')" :value="filteredEvents.length" color="#3b82f6" />
      </div>
      <div v-for="p in [...PRIORITIES].reverse()" :key="p" class="stat-card">
        <PriorityMeter
          :label="t(`dashboard.${p}Priority`)"
          :value="priorityCounts[p]"
          :color="PRIORITY_META[p].color"
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
            <option v-for="p in PRIORITIES" :key="p" :value="p">{{ t('priority.' + p) }}</option>
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
