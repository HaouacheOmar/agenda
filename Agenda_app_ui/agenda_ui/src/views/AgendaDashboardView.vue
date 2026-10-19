<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AnimatePresence, motion } from 'motion-v'
import {
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Download,
  FolderPlus,
  ListPlus,
  Trash2,
  Upload,
} from '@lucide/vue'
import FullCalendar from '../components/FullCalendar.vue'
import PriorityMeter from '../components/PriorityMeter.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import BaseModal from '../components/BaseModal.vue'
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

// formatRange collapses shared parts: "16 Oct 2026, 18:00 – 19:00".
const formatDateRange = (startDate: string, endDate: string) =>
  dateRangeFormatter.value.formatRange(new Date(startDate), new Date(endDate))

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

// +1 in LTR, -1 in RTL: horizontal slide-ins come from the inline-end side.
const inlineDir = computed(() => (locale.value === 'ar' ? -1 : 1))

// Bento tiles fade up one after another on first paint.
const tileEnter = (index: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] as const },
})

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
    <!-- Toasts -->
    <div class="toast-stack" aria-live="polite">
      <AnimatePresence>
        <motion.div
          v-for="notification in notifications"
          :key="notification.id"
          layout
          :class="['toast', `toast-${notification.type}`]"
          role="status"
          :initial="{ opacity: 0, x: 40 * inlineDir, scale: 0.96 }"
          :animate="{ opacity: 1, x: 0, scale: 1 }"
          :exit="{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }"
          :transition="{ type: 'spring', bounce: 0.2, visualDuration: 0.4 }"
        >
          <span class="toast-dot" aria-hidden="true"></span>
          <div>
            <h4>{{ notification.title }}</h4>
            <p>{{ notification.message }}</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>

    <!-- Top bar -->
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"><CalendarDays :size="22" /></span>
        <div>
          <h1>{{ t('dashboard.title') }}</h1>
          <p class="brand-tagline">{{ t('dashboard.tagline') }}</p>
        </div>
      </div>

      <div class="topbar-actions">
        <LanguageSwitcher />
        <button
          class="btn btn-ghost btn-icon"
          type="button"
          :title="t('dashboard.exportDatabase')"
          :aria-label="t('dashboard.exportDatabase')"
          :disabled="dbTransferLoading"
          @click="handleExportSQLite"
        >
          <Download :size="18" aria-hidden="true" />
        </button>
        <button
          class="btn btn-ghost btn-icon"
          type="button"
          :title="t('dashboard.importDatabase')"
          :aria-label="t('dashboard.importDatabase')"
          :disabled="dbTransferLoading"
          @click="sqliteImportInput?.click()"
        >
          <Upload :size="18" aria-hidden="true" />
        </button>
        <input
          ref="sqliteImportInput"
          type="file"
          accept=".sqlite3,.sqlite,.db,application/x-sqlite3"
          hidden
          @change="handleSQLiteImportSelected"
        />
        <button class="btn btn-secondary" type="button" @click="openCategoryModal">
          <FolderPlus :size="18" aria-hidden="true" />
          <span>{{ t('dashboard.addCategory') }}</span>
        </button>
        <button class="btn btn-secondary" type="button" @click="openEventListModal">
          <ListPlus :size="18" aria-hidden="true" />
          <span>{{ t('dashboard.addEventList') }}</span>
        </button>
        <button class="btn btn-primary" type="button" @click="openAddEventModal">
          <CalendarPlus :size="18" aria-hidden="true" />
          <span>{{ t('dashboard.addEvent') }}</span>
        </button>
      </div>
    </header>

    <p v-if="error" class="alert-error" role="alert">
      {{ error }}
      <button class="btn btn-secondary" type="button" @click="fetchEvents">{{ t('dashboard.retry') }}</button>
    </p>

    <section class="bento">
      <!-- KPI tiles -->
      <motion.div class="card tile tile-kpi tile-total" v-bind="tileEnter(0)">
        <PriorityMeter
          :label="t('dashboard.totalEvents')"
          :value="filteredEvents.length"
          :total="filteredEvents.length"
          color="#22d3ee"
        />
      </motion.div>
      <motion.div
        v-for="(p, i) in [...PRIORITIES].reverse()"
        :key="p"
        class="card tile tile-kpi"
        v-bind="tileEnter(i + 1)"
      >
        <PriorityMeter
          :label="t(`dashboard.${p}Priority`)"
          :value="priorityCounts[p]"
          :total="filteredEvents.length"
          :color="PRIORITY_META[p].color"
        />
      </motion.div>

      <!-- Calendar -->
      <motion.div class="card tile tile-calendar" v-bind="tileEnter(4)">
        <div class="filters">
          <div class="field">
            <label class="field-label" for="dashboard-category-filter">{{ t('filter.categoryLabel') }}</label>
            <select id="dashboard-category-filter" v-model="selectedCategoryValue" class="input">
              <option value="">{{ t('filter.allCategories') }}</option>
              <option v-for="cat in categories" :key="cat.id" :value="String(cat.id)">{{ cat.title }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="dashboard-eventlist-filter">{{ t('filter.label') }}</label>
            <select
              id="dashboard-eventlist-filter"
              v-model="selectedEventListValue"
              class="input"
              :disabled="!filteredEventLists.length"
            >
              <option value="">{{ t('filter.allEvents') }}</option>
              <option v-for="list in filteredEventLists" :key="list.id" :value="String(list.id)">
                {{ list.title }}
              </option>
            </select>
          </div>
        </div>
        <FullCalendar :events="filteredEvents" :loading="loading" @event-click="handleEventClick" />
      </motion.div>

      <!-- Hierarchy -->
      <motion.section class="card tile tile-hierarchy" v-bind="tileEnter(5)" aria-labelledby="hierarchy-title">
        <h2 id="hierarchy-title" class="tile-title">{{ t('dashboard.hierarchyTitle') }}</h2>

        <p v-if="!hierarchyData.length" class="empty">{{ t('dashboard.hierarchyEmpty') }}</p>

        <ul v-else class="tree">
          <li v-for="category in hierarchyData" :key="category.id" class="tree-category">
            <div class="tree-row">
              <h3>{{ category.title }}</h3>
              <button
                class="btn btn-ghost btn-icon-sm btn-icon-danger"
                type="button"
                :title="t('dashboard.deleteCategory')"
                :aria-label="`${t('dashboard.deleteCategory')}: ${category.title}`"
                @click="handleDeleteCategory(category.id)"
              >
                <Trash2 :size="16" aria-hidden="true" />
              </button>
            </div>

            <ul class="tree-lists">
              <li v-for="eventList in category.eventLists" :key="eventList.id" class="tree-list">
                <div class="tree-row">
                  <h4>{{ eventList.title }}</h4>
                  <button
                    class="btn btn-ghost btn-icon-sm btn-icon-danger"
                    type="button"
                    :title="t('dashboard.deleteEventList')"
                    :aria-label="`${t('dashboard.deleteEventList')}: ${eventList.title}`"
                    @click="handleDeleteEventList(eventList.id)"
                  >
                    <Trash2 :size="15" aria-hidden="true" />
                  </button>
                </div>

                <p v-if="!eventList.events.length" class="empty">{{ t('dashboard.noEventsInEventList') }}</p>

                <ul v-else class="tree-events">
                  <motion.li
                    v-for="(eventItem, i) in eventList.events"
                    :key="eventItem.id"
                    :initial="{ opacity: 0, x: -8 * inlineDir }"
                    :animate="{ opacity: 1, x: 0 }"
                    :transition="{ duration: 0.3, delay: 0.3 + i * 0.04 }"
                  >
                    <button
                      :class="['event-row', `event-row-${eventItem.priroty}`]"
                      type="button"
                      @click="handleEventClick(eventItem.id)"
                    >
                      <span class="event-row-main">
                        <span class="event-row-title">{{ eventItem.title }}</span>
                        <span class="event-row-dates">{{ formatDateRange(eventItem.start_date, eventItem.end_date) }}</span>
                      </span>
                      <span :class="['badge', `badge-${eventItem.priroty}`]">{{ t('priority.' + eventItem.priroty) }}</span>
                      <ChevronRight :size="16" class="event-row-chevron" aria-hidden="true" />
                    </button>
                  </motion.li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      </motion.section>
    </section>

    <!-- Add event -->
    <BaseModal
      :open="showAddEventModal"
      :title="t('modals.addEvent.title')"
      :error="formError"
      @close="closeAddEventModal"
    >
      <div class="field">
        <label class="field-label" for="new-event-title">{{ t('modals.addEvent.titleLabel') }}</label>
        <input
          id="new-event-title"
          v-model="newEventForm.title"
          type="text"
          class="input"
          :placeholder="t('modals.addEvent.titlePlaceholder')"
        />
      </div>
      <div class="field">
        <label class="field-label" for="new-event-description">{{ t('modals.addEvent.descriptionLabel') }}</label>
        <textarea
          id="new-event-description"
          v-model="newEventForm.description"
          class="input"
          rows="3"
          :placeholder="t('modals.addEvent.descriptionPlaceholder')"
        ></textarea>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label" for="new-event-start">{{ t('modals.addEvent.startDateLabel') }}</label>
          <input id="new-event-start" v-model="newEventForm.start_date" type="datetime-local" class="input" />
        </div>
        <div class="field">
          <label class="field-label" for="new-event-end">{{ t('modals.addEvent.endDateLabel') }}</label>
          <input id="new-event-end" v-model="newEventForm.end_date" type="datetime-local" class="input" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label" for="new-event-list">{{ t('modals.addEvent.eventListLabel') }}</label>
          <select id="new-event-list" v-model="newEventForm.event_list" class="input">
            <option value="" disabled>{{ t('modals.addEvent.eventListPlaceholder') }}</option>
            <option v-for="list in eventLists" :key="list.id" :value="list.id">{{ list.title }}</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="new-event-priority">{{ t('modals.addEvent.priorityLabel') }}</label>
          <select id="new-event-priority" v-model="newEventForm.priroty" class="input">
            <option v-for="p in PRIORITIES" :key="p" :value="p">{{ t('priority.' + p) }}</option>
          </select>
        </div>
      </div>
      <template #actions>
        <button class="btn btn-secondary" type="button" :disabled="formSubmitting" @click="closeAddEventModal">
          {{ t('modals.addEvent.cancel') }}
        </button>
        <button class="btn btn-primary" type="button" :disabled="formSubmitting" @click="handleCreateEvent">
          {{ formSubmitting ? t('modals.addEvent.saving') : t('modals.addEvent.create') }}
        </button>
      </template>
    </BaseModal>

    <!-- Add category -->
    <BaseModal
      :open="showCategoryModal"
      :title="t('modals.addCategory.title')"
      :error="categoryError"
      @close="closeCategoryModal"
    >
      <div class="field">
        <label class="field-label" for="new-category-title">{{ t('modals.addCategory.titleLabel') }}</label>
        <input
          id="new-category-title"
          v-model="newCategoryForm.title"
          type="text"
          class="input"
          :placeholder="t('modals.addCategory.titlePlaceholder')"
          @keyup.enter="handleCreateCategory"
        />
      </div>
      <template #actions>
        <button class="btn btn-secondary" type="button" :disabled="categorySubmitting" @click="closeCategoryModal">
          {{ t('modals.addCategory.cancel') }}
        </button>
        <button class="btn btn-primary" type="button" :disabled="categorySubmitting" @click="handleCreateCategory">
          {{ categorySubmitting ? t('modals.addCategory.creating') : t('modals.addCategory.create') }}
        </button>
      </template>
    </BaseModal>

    <!-- Add event list -->
    <BaseModal
      :open="showEventListModal"
      :title="t('modals.addEventList.title')"
      :error="eventListError"
      @close="closeEventListModal"
    >
      <div class="field">
        <label class="field-label" for="new-list-title">{{ t('modals.addEventList.titleLabel') }}</label>
        <input
          id="new-list-title"
          v-model="newEventListForm.title"
          type="text"
          class="input"
          :placeholder="t('modals.addEventList.titlePlaceholder')"
        />
      </div>
      <div class="field">
        <label class="field-label" for="new-list-category">{{ t('modals.addEventList.categoryLabel') }}</label>
        <select id="new-list-category" v-model="newEventListForm.category" class="input">
          <option value="" disabled>{{ t('modals.addEventList.categoryPlaceholder') }}</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.title }}</option>
        </select>
      </div>
      <template #actions>
        <button class="btn btn-secondary" type="button" :disabled="eventListSubmitting" @click="closeEventListModal">
          {{ t('modals.addEventList.cancel') }}
        </button>
        <button class="btn btn-primary" type="button" :disabled="eventListSubmitting" @click="handleCreateEventList">
          {{ eventListSubmitting ? t('modals.addEventList.creating') : t('modals.addEventList.create') }}
        </button>
      </template>
    </BaseModal>
  </main>
</template>
