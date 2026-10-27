<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AnimatePresence, motion } from 'motion-v'
import {
  CalendarCheck2,
  Check,
  ChevronDown,
  Download,
  Ellipsis,
  FolderPlus,
  Keyboard,
  Languages,
  ListPlus,
  Plus,
  Trash2,
  Upload,
  X,
} from '@lucide/vue'
import FullCalendar from '../components/FullCalendar.vue'
import BaseModal from '../components/BaseModal.vue'
import ActionMenu from '../components/ActionMenu.vue'
import ShortcutsDialog from '../components/ShortcutsDialog.vue'
import type { MenuItem } from '../components/menu'
import apiService from '../services/api'
import { useLocale } from '../composables/useLocale'
import { useShortcuts } from '../composables/useShortcuts'
import { daysFromToday, useDateFormat } from '../composables/useDateFormat'
import { PRIORITIES, PRIORITY_META, idOf, toIso, toLocalInput } from '../types/agenda'
import type { Category, EventItem, EventList, Priority } from '../types/agenda'
import '../styles/AgendaDashboardView.css'

const { t, locale } = useI18n()
const { toggleLocale } = useLocale()
const router = useRouter()
const { formatTime, formatDay } = useDateFormat()

const events = ref<EventItem[]>([])
const eventLists = ref<EventList[]>([])
const categories = ref<Category[]>([])
const selectedEventListId = ref<number | null>(null)
const selectedCategoryId = ref<number | null>(null)
const priorityFilter = ref<Priority | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const now = ref(Date.now())
const dbTransferLoading = ref(false)
const showShortcuts = ref(false)

const calendar = useTemplateRef<InstanceType<typeof FullCalendar>>('calendar')
const categoryFilterEl = useTemplateRef<HTMLSelectElement>('categoryFilter')
const importInput = useTemplateRef<HTMLInputElement>('importInput')

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : t('common.error'))
const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title)

// ---------- Data ----------

const listById = computed(() => new Map(eventLists.value.map((l) => [l.id, l])))
const eventCountByList = computed(() => {
  const counts = new Map<number, number>()
  for (const e of events.value) counts.set(idOf(e.event_list), (counts.get(idOf(e.event_list)) ?? 0) + 1)
  return counts
})

const filteredEventLists = computed(() =>
  selectedCategoryId.value
    ? eventLists.value.filter((list) => idOf(list.category) === selectedCategoryId.value)
    : eventLists.value,
)

// Category / list scope (priority is applied on top, per view).
const scopedEvents = computed(() => {
  if (!selectedEventListId.value && !selectedCategoryId.value) return events.value
  const visible = new Set(
    filteredEventLists.value
      .filter((list) => !selectedEventListId.value || list.id === selectedEventListId.value)
      .map((list) => list.id),
  )
  return events.value.filter((event) => visible.has(idOf(event.event_list)))
})

const calendarEvents = computed(() =>
  priorityFilter.value ? scopedEvents.value.filter((e) => e.priroty === priorityFilter.value) : scopedEvents.value,
)

const upcoming = computed(() =>
  scopedEvents.value
    .filter((e) => new Date(e.end_date).getTime() >= now.value)
    .sort((a, b) => a.start_date.localeCompare(b.start_date)),
)

const priorityCounts = computed(() => {
  const counts: Record<Priority, number> = { low: 0, medium: 0, high: 0 }
  for (const e of upcoming.value) counts[e.priroty]++
  return counts
})

type GroupKey = 'today' | 'tomorrow' | 'thisWeek' | 'later'
const agendaGroups = computed(() => {
  const groups: Record<GroupKey, EventItem[]> = { today: [], tomorrow: [], thisWeek: [], later: [] }
  for (const e of upcoming.value) {
    if (priorityFilter.value && e.priroty !== priorityFilter.value) continue
    const days = daysFromToday(e.start_date, new Date(now.value))
    groups[days <= 0 ? 'today' : days === 1 ? 'tomorrow' : days < 7 ? 'thisWeek' : 'later'].push(e)
  }
  return (Object.keys(groups) as GroupKey[])
    .filter((key) => groups[key].length)
    .map((key) => ({ key, label: t(`upNext.${key}`), items: groups[key] }))
})

const organizeData = computed(() =>
  [...categories.value].sort(byTitle).map((category) => {
    const lists = eventLists.value
      .filter((l) => idOf(l.category) === category.id)
      .sort(byTitle)
      .map((l) => ({ ...l, count: eventCountByList.value.get(l.id) ?? 0 }))
    return { ...category, lists, count: lists.reduce((sum, l) => sum + l.count, 0) }
  }),
)

// Lists grouped by category for <optgroup>.
const listsByCategory = computed(() =>
  organizeData.value.filter((c) => c.lists.length).map((c) => ({ id: c.id, title: c.title, lists: c.lists })),
)

const onboardingStep = computed(() => (!categories.value.length ? 1 : !eventLists.value.length ? 2 : 3))

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

// Keep filters consistent: a list filter must belong to the selected category, and picking a list selects its category.
watch(selectedCategoryId, (categoryId) => {
  const list = listById.value.get(selectedEventListId.value ?? -1)
  if (list && categoryId && idOf(list.category) !== categoryId) selectedEventListId.value = null
})
watch(selectedEventListId, (eventListId) => {
  const list = listById.value.get(eventListId ?? -1)
  if (list) selectedCategoryId.value = idOf(list.category)
})

const fetchEvents = async () => {
  error.value = null
  try {
    events.value = await apiService.getEvents()
    checkUpcomingEvents()
  } catch (err) {
    error.value = t('dashboard.error')
    console.error(err)
  }
}
const fetchEventLists = async () => {
  eventLists.value = await apiService.getEventLists().catch(() => eventLists.value)
}
const fetchCategories = async () => {
  categories.value = await apiService.getCategories().catch(() => categories.value)
}
const fetchAll = async () => {
  await Promise.all([fetchCategories(), fetchEventLists(), fetchEvents()])
  loading.value = false
}

// ---------- Create modals ----------

type ModalKind = 'event' | 'category' | 'list'
const modal = ref<ModalKind | null>(null)
const submitting = ref(false)
const submitted = ref(false)
const formError = ref<string | null>(null)

const plusOneHour = (local: string) => toLocalInput(new Date(new Date(local).getTime() + 36e5).toISOString())

const emptyEventForm = (start = '') => ({
  title: '',
  description: '',
  start_date: start,
  end_date: start ? plusOneHour(start) : '',
  event_list: (selectedEventListId.value ?? '') as '' | number,
  priroty: (priorityFilter.value ?? 'medium') as Priority,
})
const eventForm = ref(emptyEventForm())
const categoryForm = ref({ title: '' })
const listForm = ref({ title: '', category: '' as '' | number })

// Moving the start never leaves the end before it.
watch(
  () => eventForm.value.start_date,
  (start) => {
    if (start && (!eventForm.value.end_date || eventForm.value.end_date <= start)) {
      eventForm.value.end_date = plusOneHour(start)
    }
  },
)

const openModal = (kind: ModalKind, startLocal = '') => {
  formError.value = null
  submitted.value = false
  if (kind === 'event') eventForm.value = emptyEventForm(startLocal)
  if (kind === 'category') categoryForm.value = { title: '' }
  if (kind === 'list') listForm.value = { title: '', category: selectedCategoryId.value ?? '' }
  modal.value = kind
}
const closeModal = () => {
  modal.value = null
}

const handleDateClick = (date: Date) => {
  const start = new Date(date)
  start.setHours(9, 0, 0, 0)
  openModal('event', toLocalInput(start.toISOString()))
}

const submit = async (validate: () => string | null, save: () => Promise<unknown>) => {
  if (submitting.value) return // double Enter / double click must not create twice
  submitted.value = true
  formError.value = validate()
  if (formError.value) return
  submitting.value = true
  try {
    await save()
    closeModal()
  } catch (err) {
    formError.value = errorMessage(err)
  } finally {
    submitting.value = false
  }
}

const handleCreateEvent = () =>
  submit(
    () => {
      const f = eventForm.value
      if (!f.title.trim() || !f.start_date || !f.end_date || !f.event_list) return t('modals.addEvent.error')
      if (f.end_date < f.start_date) return t('modals.addEvent.dateOrderError')
      return null
    },
    async () => {
      const f = eventForm.value
      await apiService.createEvent({
        ...f,
        title: f.title.trim(),
        event_list: Number(f.event_list),
        start_date: toIso(f.start_date),
        end_date: toIso(f.end_date),
        notified: false,
      })
      await fetchEvents()
    },
  )

const handleCreateCategory = () =>
  submit(
    () => (categoryForm.value.title.trim() ? null : t('modals.addCategory.error')),
    async () => {
      await apiService.createCategory({ title: categoryForm.value.title.trim() })
      await fetchCategories()
    },
  )

const handleCreateEventList = () =>
  submit(
    () => (listForm.value.title.trim() && listForm.value.category ? null : t('modals.addEventList.error')),
    async () => {
      await apiService.createEventList({ title: listForm.value.title.trim(), category: Number(listForm.value.category) })
      await fetchEventLists()
    },
  )

// ---------- Confirmations (destructive / replacing actions) ----------

interface ConfirmState {
  title: string
  body: string
  confirmLabel: string
  run: () => Promise<void>
}
const confirmState = ref<ConfirmState | null>(null)
const confirmBusy = ref(false)

const runConfirm = async () => {
  if (!confirmState.value || confirmBusy.value) return
  confirmBusy.value = true
  try {
    await confirmState.value.run()
    confirmState.value = null
  } catch (err) {
    confirmState.value = null
    pushToast({ kind: 'error', title: t('common.error'), message: errorMessage(err) })
  } finally {
    confirmBusy.value = false
  }
}

const askDeleteCategory = (category: (typeof organizeData.value)[number]) => {
  confirmState.value = {
    title: t('confirm.deleteCategoryTitle', { name: category.title }),
    body: t('confirm.deleteCategoryBody', {
      lists: t('organize.lists', category.lists.length),
      events: t('organize.events', category.count),
    }),
    confirmLabel: t('confirm.delete'),
    run: async () => {
      await apiService.deleteCategory(category.id)
      if (selectedCategoryId.value === category.id) {
        selectedCategoryId.value = null
        selectedEventListId.value = null
      }
      await fetchAll()
      pushToast({ kind: 'info', title: t('dashboard.deleted', { name: category.title }), message: '' })
    },
  }
}

const askDeleteEventList = (list: { id: number; title: string; count: number }) => {
  confirmState.value = {
    title: t('confirm.deleteListTitle', { name: list.title }),
    body: t('confirm.deleteListBody', { events: t('organize.events', list.count) }),
    confirmLabel: t('confirm.delete'),
    run: async () => {
      await apiService.deleteEventList(list.id)
      if (selectedEventListId.value === list.id) selectedEventListId.value = null
      await Promise.all([fetchEventLists(), fetchEvents()])
      pushToast({ kind: 'info', title: t('dashboard.deleted', { name: list.title }), message: '' })
    },
  }
}

// ---------- Export / import ----------

const buildBackupFileName = () => {
  const pad = (value: number) => String(value).padStart(2, '0')
  const d = new Date()
  return `agenda-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`
}

const handleExport = async () => {
  dbTransferLoading.value = true
  try {
    const url = URL.createObjectURL(await apiService.exportData())
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = buildBackupFileName()
    anchor.click()
    URL.revokeObjectURL(url)
    pushToast({ kind: 'info', title: t('dashboard.exportDatabaseSuccess'), message: '' })
  } catch (err) {
    pushToast({ kind: 'error', title: t('dashboard.exportDatabaseError'), message: errorMessage(err) })
  } finally {
    dbTransferLoading.value = false
  }
}

const handleImportSelected = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  confirmState.value = {
    title: t('confirm.importTitle', { file: file.name }),
    body: t('confirm.importBody', { events: t('organize.events', events.value.length) }),
    confirmLabel: t('confirm.importConfirm'),
    run: async () => {
      dbTransferLoading.value = true
      try {
        await apiService.importData(file)
        await fetchAll()
        pushToast({ kind: 'info', title: t('dashboard.importDatabaseSuccess'), message: '' })
      } finally {
        dbTransferLoading.value = false
      }
    },
  }
}

// ---------- Toasts and reminders ----------

interface Toast {
  id: string
  kind: 'reminder' | 'info' | 'error'
  title: string
  message: string
  priority?: Priority
  eventId?: number
}
const toasts = ref<Toast[]>([])
const remindersShown = new Set<number>()

const pushToast = (toast: Omit<Toast, 'id'>) => {
  const id = `${Date.now()}-${Math.random()}`
  toasts.value = [...toasts.value, { ...toast, id }]
  // Reminders stay until the user acts on them; feedback toasts leave on their own.
  if (toast.kind !== 'reminder') setTimeout(() => removeToast(id), 5000)
}
const removeToast = (id: string) => {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

// A reminder counts as delivered once the user has seen it: dismissed or opened.
const markReminded = (eventId?: number) => {
  const event = events.value.find((e) => e.id === eventId)
  if (!event || event.notified) return
  event.notified = true
  apiService
    .updateEvent(event.id, { ...event, event_list: idOf(event.event_list) })
    .catch((err) => console.error('Failed to save reminder state:', err))
}
const dismissToast = (toast: Toast) => {
  removeToast(toast.id)
  if (toast.kind === 'reminder') markReminded(toast.eventId)
}
const openToast = (toast: Toast) => {
  dismissToast(toast)
  if (toast.eventId) router.push({ name: 'event-detail', params: { id: toast.eventId } })
}

const checkUpcomingEvents = () => {
  for (const event of events.value) {
    if (event.notified || remindersShown.has(event.id)) continue
    const start = new Date(event.start_date).getTime()
    const days = daysFromToday(event.start_date)
    if (start < Date.now() || days > PRIORITY_META[event.priroty].notifyDays) continue
    remindersShown.add(event.id)
    const message = days === 0 ? t('notifications.today', { time: formatTime(event.start_date) }) : t('notifications.inDays', days)
    pushToast({ kind: 'reminder', title: event.title, message, priority: event.priroty, eventId: event.id })
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(event.title, { body: message, tag: `event-${event.id}` })
    }
  }
}

// ---------- Navigation, menus, shortcuts ----------

const openEvent = (id: number) => router.push({ name: 'event-detail', params: { id } })
const listTitle = (event: EventItem) => listById.value.get(idOf(event.event_list))?.title ?? ''
const showListInCalendar = (listId: number) => {
  selectedEventListId.value = listId
}

const newMenu = computed<MenuItem[]>(() => [
  { id: 'category', label: t('actions.newCategory'), icon: FolderPlus, shortcut: 'C', onSelect: () => openModal('category') },
  { id: 'list', label: t('actions.newEventList'), icon: ListPlus, shortcut: 'L', onSelect: () => openModal('list') },
])
const moreMenu = computed<MenuItem[]>(() => [
  { id: 'shortcuts', label: t('actions.shortcuts'), icon: Keyboard, shortcut: '?', onSelect: () => (showShortcuts.value = true) },
  { id: 'language', label: t('common.otherLanguage'), icon: Languages, onSelect: toggleLocale },
  { id: 'export', label: t('actions.export'), icon: Download, onSelect: handleExport },
  { id: 'import', label: t('actions.import'), icon: Upload, onSelect: () => importInput.value?.click() },
])

// In RTL the calendar mirrors, so ← moves forward in time.
const step = (direction: 1 | -1) => (direction * (locale.value === 'ar' ? -1 : 1) > 0 ? calendar.value?.next() : calendar.value?.prev())
useShortcuts({
  n: () => openModal('event'),
  c: () => openModal('category'),
  l: () => openModal('list'),
  t: () => calendar.value?.today(),
  ArrowLeft: () => step(-1),
  ArrowRight: () => step(1),
  '0': () => (priorityFilter.value = null),
  '1': () => (priorityFilter.value = 'high'),
  '2': () => (priorityFilter.value = 'medium'),
  '3': () => (priorityFilter.value = 'low'),
  '/': () => categoryFilterEl.value?.focus(),
  '?': () => (showShortcuts.value = true),
})

const priorityKey: Record<Priority, string> = { high: '1', medium: '2', low: '3' }
const priorityOrder = [...PRIORITIES].reverse()

let ticker: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  fetchAll()
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
  ticker = setInterval(() => {
    now.value = Date.now()
    checkUpcomingEvents()
  }, 60_000)
})
onUnmounted(() => clearInterval(ticker))
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"><CalendarCheck2 :size="20" /></span>
        <div>
          <h1>{{ t('app.title') }}</h1>
          <p class="brand-tagline">{{ t('app.tagline') }}</p>
        </div>
      </div>

      <div class="topbar-actions">
        <ActionMenu :label="t('actions.more')" :items="moreMenu" icon-only>
          <template #trigger><Ellipsis :size="18" aria-hidden="true" /></template>
        </ActionMenu>
        <ActionMenu :label="t('actions.new')" :items="newMenu">
          <template #trigger>
            <span>{{ t('actions.new') }}</span>
            <ChevronDown :size="16" aria-hidden="true" />
          </template>
        </ActionMenu>
        <button class="btn btn-primary new-event-btn" type="button" aria-keyshortcuts="n" @click="openModal('event')">
          <Plus :size="18" aria-hidden="true" />
          <span>{{ t('actions.newEvent') }}</span>
          <kbd aria-hidden="true">N</kbd>
        </button>
        <input
          ref="importInput"
          type="file"
          accept=".json,application/json"
          hidden
          @change="handleImportSelected"
        />
      </div>
    </header>

    <p v-if="error" class="alert-error page-alert" role="alert">
      {{ error }}
      <button class="btn btn-secondary" type="button" @click="fetchAll">{{ t('dashboard.retry') }}</button>
    </p>

    <main class="layout">
      <!-- Up next -->
      <section class="card panel agenda" aria-labelledby="agenda-title">
        <header class="panel-header">
          <h2 id="agenda-title">{{ t('upNext.title') }}</h2>
        </header>

        <div class="chips" role="group" :aria-label="t('filter.priorityLabel')">
          <button
            type="button"
            class="chip"
            :aria-pressed="priorityFilter === null"
            aria-keyshortcuts="0"
            :title="`${t('filter.all')} (0)`"
            @click="priorityFilter = null"
          >
            {{ t('filter.all') }} <span class="chip-count">{{ upcoming.length }}</span>
          </button>
          <button
            v-for="p in priorityOrder"
            :key="p"
            type="button"
            :class="['chip', `chip-${p}`]"
            :aria-pressed="priorityFilter === p"
            :aria-keyshortcuts="priorityKey[p]"
            :title="`${t('priority.' + p)} (${priorityKey[p]})`"
            @click="priorityFilter = priorityFilter === p ? null : p"
          >
            <span class="chip-dot" aria-hidden="true"></span>
            {{ t('priority.' + p) }} <span class="chip-count">{{ priorityCounts[p] }}</span>
          </button>
        </div>

        <div v-if="loading" class="agenda-skeleton" aria-hidden="true">
          <span v-for="i in 4" :key="i"></span>
        </div>

        <!-- First run: teach the model by doing it -->
        <div v-else-if="!events.length" class="onboarding">
          <h3>{{ t('onboarding.title') }}</h3>
          <ol>
            <li v-for="n in 3" :key="n" :class="{ done: onboardingStep > n, current: onboardingStep === n }">
              <span class="step-mark" aria-hidden="true">
                <Check v-if="onboardingStep > n" :size="14" />
                <template v-else>{{ n }}</template>
              </span>
              <span>{{ t(`onboarding.step${n}`) }}</span>
            </li>
          </ol>
          <button v-if="onboardingStep === 1" class="btn btn-primary" type="button" @click="openModal('category')">
            <FolderPlus :size="16" aria-hidden="true" /> {{ t('modals.addCategory.title') }}
          </button>
          <button v-else-if="onboardingStep === 2" class="btn btn-primary" type="button" @click="openModal('list')">
            <ListPlus :size="16" aria-hidden="true" /> {{ t('modals.addEventList.title') }}
          </button>
          <button v-else class="btn btn-primary" type="button" @click="openModal('event')">
            <Plus :size="16" aria-hidden="true" /> {{ t('actions.newEvent') }}
          </button>
        </div>

        <p v-else-if="!agendaGroups.length" class="empty">
          {{ priorityFilter ? t('upNext.emptyFiltered') : t('upNext.empty') }}
          <button v-if="priorityFilter" class="link" type="button" @click="priorityFilter = null">
            {{ t('upNext.showAll') }}
          </button>
        </p>

        <div v-else class="agenda-groups">
          <section v-for="group in agendaGroups" :key="group.key" class="agenda-group">
            <h3>{{ group.label }}</h3>
            <ul>
              <AnimatePresence :initial="false">
                <motion.li
                  v-for="event in group.items"
                  :key="event.id"
                  layout="position"
                  :initial="{ opacity: 0 }"
                  :animate="{ opacity: 1 }"
                  :exit="{ opacity: 0, transition: { duration: 0.1 } }"
                  :transition="{ duration: 0.18 }"
                >
                  <button class="agenda-item" type="button" @click="openEvent(event.id)">
                    <span class="agenda-when">
                      <span v-if="group.key === 'thisWeek' || group.key === 'later'" class="agenda-day">
                        {{ formatDay(event.start_date) }}
                      </span>
                      <span class="agenda-time">{{ formatTime(event.start_date) }}</span>
                    </span>
                    <span class="agenda-main">
                      <span class="agenda-title bidi-auto">{{ event.title }}</span>
                      <span class="agenda-meta">
                        <span class="bidi-auto">{{ listTitle(event) }}</span>
                        <template v-if="group.key === 'thisWeek' || group.key === 'later'">
                          · {{ t('upNext.inDays', daysFromToday(event.start_date, new Date(now))) }}
                        </template>
                      </span>
                    </span>
                    <span :class="['badge', `badge-${event.priroty}`]">{{ t('priority.' + event.priroty) }}</span>
                  </button>
                </motion.li>
              </AnimatePresence>
            </ul>
          </section>
        </div>
      </section>

      <!-- Calendar -->
      <section class="card panel calendar-panel" :aria-label="t('calendar.title')">
        <div class="filters">
          <div class="field">
            <label class="field-label" for="dashboard-category-filter">
              {{ t('filter.categoryLabel') }} <kbd aria-hidden="true">/</kbd>
            </label>
            <select
              id="dashboard-category-filter"
              ref="categoryFilter"
              v-model="selectedCategoryValue"
              class="input"
              aria-keyshortcuts="/"
            >
              <option value="">{{ t('filter.allCategories') }}</option>
              <option v-for="cat in categories" :key="cat.id" :value="String(cat.id)">{{ cat.title }}</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="dashboard-eventlist-filter">{{ t('filter.listLabel') }}</label>
            <select
              id="dashboard-eventlist-filter"
              v-model="selectedEventListValue"
              class="input"
              :disabled="!filteredEventLists.length"
            >
              <option value="">{{ t('filter.allLists') }}</option>
              <option v-for="list in filteredEventLists" :key="list.id" :value="String(list.id)">{{ list.title }}</option>
            </select>
          </div>
        </div>
        <FullCalendar
          ref="calendar"
          :events="calendarEvents"
          :loading="loading"
          @event-click="openEvent"
          @date-click="handleDateClick"
        />
      </section>

      <!-- Structure -->
      <section v-if="organizeData.length" class="card panel organize" aria-labelledby="organize-title">
        <header class="panel-header">
          <h2 id="organize-title">{{ t('organize.title') }}</h2>
        </header>
        <ul class="organize-grid">
          <li v-for="category in organizeData" :key="category.id" class="organize-category">
            <div class="organize-row organize-row-category">
              <h3 class="bidi-auto">{{ category.title }}</h3>
              <span class="organize-count">{{ t('organize.events', category.count) }}</span>
              <button
                class="btn btn-ghost btn-icon-sm btn-icon-danger"
                type="button"
                :title="t('organize.deleteCategory')"
                :aria-label="`${t('organize.deleteCategory')}: ${category.title}`"
                @click="askDeleteCategory(category)"
              >
                <Trash2 :size="16" aria-hidden="true" />
              </button>
            </div>
            <p v-if="!category.lists.length" class="empty">{{ t('organize.noLists') }}</p>
            <ul v-else class="organize-lists">
              <li v-for="list in category.lists" :key="list.id" class="organize-row">
                <button
                  :class="['organize-list-btn', { active: selectedEventListId === list.id }]"
                  type="button"
                  :aria-pressed="selectedEventListId === list.id"
                  :title="t('organize.showList', { name: list.title })"
                  @click="showListInCalendar(list.id)"
                >
                  <span class="bidi-auto">{{ list.title }}</span>
                  <span class="organize-count">{{ list.count }}</span>
                </button>
                <button
                  class="btn btn-ghost btn-icon-sm btn-icon-danger"
                  type="button"
                  :title="t('organize.deleteEventList')"
                  :aria-label="`${t('organize.deleteEventList')}: ${list.title}`"
                  @click="askDeleteEventList(list)"
                >
                  <Trash2 :size="15" aria-hidden="true" />
                </button>
              </li>
            </ul>
          </li>
        </ul>
      </section>
    </main>

    <!-- Thumb-reach primary action on phones -->
    <button class="fab btn btn-primary" type="button" :aria-label="t('actions.newEvent')" @click="openModal('event')">
      <Plus :size="22" aria-hidden="true" />
    </button>

    <!-- Toasts: bottom inline-end, away from the header actions -->
    <div class="toast-stack" aria-live="polite">
      <AnimatePresence>
        <motion.div
          v-for="toast in toasts"
          :key="toast.id"
          layout
          :class="['toast', `toast-${toast.kind}`, toast.priority && `toast-${toast.priority}`]"
          role="status"
          :initial="{ opacity: 0, transform: 'translateY(12px) scale(0.98)' }"
          :animate="{ opacity: 1, transform: 'translateY(0px) scale(1)' }"
          :exit="{ opacity: 0, transform: 'scale(0.98)', transition: { duration: 0.12 } }"
          :transition="{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }"
        >
          <span v-if="toast.priority" class="toast-dot" aria-hidden="true"></span>
          <button v-if="toast.eventId" class="toast-body" type="button" :title="t('notifications.open')" @click="openToast(toast)">
            <strong class="bidi-auto">{{ toast.title }}</strong>
            <span v-if="toast.message">{{ toast.message }}</span>
          </button>
          <div v-else class="toast-body">
            <strong>{{ toast.title }}</strong>
            <span v-if="toast.message">{{ toast.message }}</span>
          </div>
          <button class="btn btn-ghost btn-icon-sm" type="button" :aria-label="t('notifications.dismiss')" @click="dismissToast(toast)">
            <X :size="16" aria-hidden="true" />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>

    <!-- New event -->
    <BaseModal
      :open="modal === 'event'"
      :title="t('modals.addEvent.title')"
      :error="formError"
      @close="closeModal"
      @submit="handleCreateEvent"
    >
      <div class="field">
        <label class="field-label" for="new-event-title">{{ t('modals.addEvent.titleLabel') }}</label>
        <input
          id="new-event-title"
          v-model="eventForm.title"
          type="text"
          class="input"
          maxlength="200"
          :aria-invalid="submitted && !eventForm.title.trim()"
          :placeholder="t('modals.addEvent.titlePlaceholder')"
        />
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label" for="new-event-start">{{ t('modals.addEvent.startDateLabel') }}</label>
          <input
            id="new-event-start"
            v-model="eventForm.start_date"
            type="datetime-local"
            class="input"
            :aria-invalid="submitted && !eventForm.start_date"
          />
        </div>
        <div class="field">
          <label class="field-label" for="new-event-end">{{ t('modals.addEvent.endDateLabel') }}</label>
          <input
            id="new-event-end"
            v-model="eventForm.end_date"
            type="datetime-local"
            class="input"
            :min="eventForm.start_date || undefined"
            :aria-invalid="submitted && (!eventForm.end_date || eventForm.end_date < eventForm.start_date)"
          />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label" for="new-event-list">{{ t('modals.addEvent.eventListLabel') }}</label>
          <select
            id="new-event-list"
            v-model="eventForm.event_list"
            class="input"
            :aria-invalid="submitted && !eventForm.event_list"
          >
            <option value="" disabled>{{ t('modals.addEvent.eventListPlaceholder') }}</option>
            <optgroup v-for="group in listsByCategory" :key="group.id" :label="group.title">
              <option v-for="list in group.lists" :key="list.id" :value="list.id">{{ list.title }}</option>
            </optgroup>
          </select>
          <p v-if="!eventLists.length" class="field-error">{{ t('modals.addEvent.noLists') }}</p>
        </div>
        <div class="field">
          <label class="field-label" for="new-event-priority">{{ t('modals.addEvent.priorityLabel') }}</label>
          <select id="new-event-priority" v-model="eventForm.priroty" class="input" aria-describedby="new-event-reminder">
            <option v-for="p in priorityOrder" :key="p" :value="p">{{ t('priority.' + p) }}</option>
          </select>
        </div>
      </div>
      <p id="new-event-reminder" class="hint">
        {{ t('modals.addEvent.reminderHint', PRIORITY_META[eventForm.priroty].notifyDays) }}
      </p>
      <div class="field">
        <label class="field-label" for="new-event-description">{{ t('modals.addEvent.descriptionLabel') }}</label>
        <textarea
          id="new-event-description"
          v-model="eventForm.description"
          class="input"
          rows="3"
          :placeholder="t('modals.addEvent.descriptionPlaceholder')"
        ></textarea>
      </div>
      <template #actions>
        <button class="btn btn-secondary" type="button" :disabled="submitting" @click="closeModal">
          {{ t('modals.addEvent.cancel') }}
        </button>
        <button class="btn btn-primary" type="button" :disabled="submitting" @click="handleCreateEvent">
          {{ submitting ? t('modals.addEvent.saving') : t('modals.addEvent.create') }}
        </button>
      </template>
    </BaseModal>

    <!-- New category -->
    <BaseModal
      :open="modal === 'category'"
      :title="t('modals.addCategory.title')"
      :error="formError"
      size="sm"
      @close="closeModal"
      @submit="handleCreateCategory"
    >
      <div class="field">
        <label class="field-label" for="new-category-title">{{ t('modals.addCategory.titleLabel') }}</label>
        <input
          id="new-category-title"
          v-model="categoryForm.title"
          type="text"
          class="input"
          maxlength="100"
          :aria-invalid="submitted && !categoryForm.title.trim()"
          :placeholder="t('modals.addCategory.titlePlaceholder')"
          @keydown.enter.exact.prevent="handleCreateCategory"
        />
      </div>
      <template #actions>
        <button class="btn btn-secondary" type="button" :disabled="submitting" @click="closeModal">
          {{ t('modals.addCategory.cancel') }}
        </button>
        <button class="btn btn-primary" type="button" :disabled="submitting" @click="handleCreateCategory">
          {{ submitting ? t('modals.addCategory.creating') : t('modals.addCategory.create') }}
        </button>
      </template>
    </BaseModal>

    <!-- New event list -->
    <BaseModal
      :open="modal === 'list'"
      :title="t('modals.addEventList.title')"
      :error="formError"
      size="sm"
      @close="closeModal"
      @submit="handleCreateEventList"
    >
      <div class="field">
        <label class="field-label" for="new-list-title">{{ t('modals.addEventList.titleLabel') }}</label>
        <input
          id="new-list-title"
          v-model="listForm.title"
          type="text"
          class="input"
          maxlength="100"
          :aria-invalid="submitted && !listForm.title.trim()"
          :placeholder="t('modals.addEventList.titlePlaceholder')"
        />
      </div>
      <div class="field">
        <label class="field-label" for="new-list-category">{{ t('modals.addEventList.categoryLabel') }}</label>
        <select
          id="new-list-category"
          v-model="listForm.category"
          class="input"
          :aria-invalid="submitted && !listForm.category"
        >
          <option value="" disabled>{{ t('modals.addEventList.categoryPlaceholder') }}</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.title }}</option>
        </select>
        <p v-if="!categories.length" class="field-error">{{ t('modals.addEventList.noCategories') }}</p>
      </div>
      <template #actions>
        <button class="btn btn-secondary" type="button" :disabled="submitting" @click="closeModal">
          {{ t('modals.addEventList.cancel') }}
        </button>
        <button class="btn btn-primary" type="button" :disabled="submitting" @click="handleCreateEventList">
          {{ submitting ? t('modals.addEventList.creating') : t('modals.addEventList.create') }}
        </button>
      </template>
    </BaseModal>

    <!-- Confirmation for destructive / replacing actions -->
    <BaseModal
      :open="confirmState !== null"
      :title="confirmState?.title ?? ''"
      size="sm"
      @close="confirmState = null"
      @submit="runConfirm"
    >
      <p class="confirm-body">{{ confirmState?.body }}</p>
      <template #actions>
        <button class="btn btn-secondary" type="button" :disabled="confirmBusy" @click="confirmState = null">
          {{ t('confirm.cancel') }}
        </button>
        <button class="btn btn-danger" type="button" :disabled="confirmBusy" @click="runConfirm">
          {{ confirmState?.confirmLabel }}
        </button>
      </template>
    </BaseModal>

    <ShortcutsDialog :open="showShortcuts" @close="showShortcuts = false" />
  </div>
</template>
