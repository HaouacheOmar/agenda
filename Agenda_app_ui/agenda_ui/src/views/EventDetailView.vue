<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { motion } from 'motion-v'
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, Trash2 } from '@lucide/vue'
import apiService from '../services/api'
import BaseModal from '../components/BaseModal.vue'
import { useShortcuts } from '../composables/useShortcuts'
import { useDateFormat } from '../composables/useDateFormat'
import { PRIORITIES, PRIORITY_META, idOf, toIso, toLocalInput } from '../types/agenda'
import type { Category, EventItem, EventList } from '../types/agenda'
import '../styles/EventDetailView.css'

const props = defineProps<{ id: number }>()

const { t } = useI18n()
const router = useRouter()
const { formatFull, formatRange } = useDateFormat()

const event = ref<EventItem | null>(null)
const allEvents = ref<EventItem[]>([])
const eventLists = ref<EventList[]>([])
const categories = ref<Category[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const isEditing = ref(false)
const deleteConfirm = ref(false)

const eventList = computed(() => {
  const listRef = event.value?.event_list
  if (!listRef) return null
  return typeof listRef === 'object' ? listRef : (eventLists.value.find((l) => l.id === listRef) ?? null)
})
const category = computed(() =>
  eventList.value ? (categories.value.find((c) => c.id === idOf(eventList.value!.category)) ?? null) : null,
)

const sameDay = computed(
  () => event.value && new Date(event.value.start_date).toDateString() === new Date(event.value.end_date).toDateString(),
)

// Previous / next by start time, across the whole agenda.
const ordered = computed(() => [...allEvents.value].sort((a, b) => a.start_date.localeCompare(b.start_date)))
const position = computed(() => ordered.value.findIndex((e) => e.id === props.id))
const previousEvent = computed(() => (position.value > 0 ? ordered.value[position.value - 1] : undefined))
const nextEvent = computed(() => (position.value >= 0 ? ordered.value[position.value + 1] : undefined))

const listsByCategory = computed(() =>
  [...categories.value]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((c) => ({ ...c, lists: eventLists.value.filter((l) => idOf(l.category) === c.id) }))
    .filter((c) => c.lists.length),
)

const toForm = (e: EventItem) => ({
  title: e.title,
  description: e.description,
  start_date: toLocalInput(e.start_date),
  end_date: toLocalInput(e.end_date),
  priroty: e.priroty,
  event_list: idOf(e.event_list),
  notified: e.notified,
})

const formData = ref<ReturnType<typeof toForm>>({
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  priroty: 'medium',
  event_list: 0,
  notified: false,
})

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : t('common.error'))

const setEvent = (e: EventItem) => {
  event.value = e
  formData.value = toForm(e)
}

const fetchEventDetail = async () => {
  loading.value = true
  error.value = null
  isEditing.value = false
  try {
    const [e, lists, cats, all] = await Promise.all([
      apiService.getEventById(props.id),
      apiService.getEventLists(),
      apiService.getCategories(),
      apiService.getEvents(),
    ])
    eventLists.value = lists
    categories.value = cats
    allEvents.value = all
    setEvent(e)
  } catch (err) {
    event.value = null
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

const startEdit = () => {
  if (!event.value) return
  formData.value = toForm(event.value)
  error.value = null
  isEditing.value = true
}

const handleUpdate = async () => {
  if (!event.value) return
  const f = formData.value
  if (!f.title.trim() || !f.start_date || !f.end_date) {
    error.value = t('modals.addEvent.error')
    return
  }
  if (f.end_date < f.start_date) {
    error.value = t('modals.addEvent.dateOrderError')
    return
  }
  saving.value = true
  error.value = null
  try {
    setEvent(
      await apiService.updateEvent(event.value.id, {
        ...f,
        title: f.title.trim(),
        start_date: toIso(f.start_date),
        end_date: toIso(f.end_date),
      }),
    )
    allEvents.value = allEvents.value.map((e) => (e.id === event.value!.id ? event.value! : e))
    isEditing.value = false
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    saving.value = false
  }
}

const handleDelete = async () => {
  if (!event.value) return
  saving.value = true
  try {
    await apiService.deleteEvent(event.value.id)
    router.push({ name: 'dashboard' })
  } catch (err) {
    deleteConfirm.value = false
    error.value = errorMessage(err)
  } finally {
    saving.value = false
  }
}

const cancelEdit = () => {
  if (event.value) formData.value = toForm(event.value)
  error.value = null
  isEditing.value = false
}

// On the article, not the form: the title field lives in the header, outside <form>.
const onEditKeydown = (e: KeyboardEvent) => {
  if (!isEditing.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    cancelEdit()
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    handleUpdate()
  }
}

const goTo = (target?: EventItem) => target && router.push({ name: 'event-detail', params: { id: target.id } })
const goBack = () => router.push({ name: 'dashboard' })

useShortcuts({
  e: () => !isEditing.value && startEdit(),
  d: () => event.value && (deleteConfirm.value = true),
  j: () => goTo(nextEvent.value),
  k: () => goTo(previousEvent.value),
  Escape: () => (isEditing.value ? cancelEdit() : goBack()),
})

watch(() => props.id, fetchEventDetail)
onMounted(fetchEventDetail)
</script>

<template>
  <main class="event-detail">
    <nav class="detail-nav">
      <button class="btn btn-ghost" type="button" aria-keyshortcuts="Escape" @click="goBack">
        <ArrowLeft :size="18" class="flip-rtl" aria-hidden="true" />
        {{ t('eventDetail.back') }}
        <kbd aria-hidden="true">Esc</kbd>
      </button>
      <div class="detail-stepper">
        <button
          class="btn btn-ghost btn-icon"
          type="button"
          :disabled="!previousEvent"
          :aria-label="t('eventDetail.previous')"
          :title="`${t('eventDetail.previous')} (K)`"
          aria-keyshortcuts="k"
          @click="goTo(previousEvent)"
        >
          <ChevronLeft :size="18" class="flip-rtl" aria-hidden="true" />
        </button>
        <button
          class="btn btn-ghost btn-icon"
          type="button"
          :disabled="!nextEvent"
          :aria-label="t('eventDetail.next')"
          :title="`${t('eventDetail.next')} (J)`"
          aria-keyshortcuts="j"
          @click="goTo(nextEvent)"
        >
          <ChevronRight :size="18" class="flip-rtl" aria-hidden="true" />
        </button>
      </div>
    </nav>

    <div v-if="loading && !event" class="card state" aria-busy="true">
      <span class="spinner" aria-hidden="true"></span>
      <p>{{ t('eventDetail.loadingEvent') }}</p>
    </div>

    <div v-else-if="error && !event" class="alert-error" role="alert">
      {{ error }}
      <button class="btn btn-secondary" type="button" @click="fetchEventDetail">{{ t('common.retry') }}</button>
    </div>

    <motion.article
      v-else-if="event"
      :key="event.id"
      class="card detail"
      :initial="{ opacity: 0, transform: 'translateY(6px)' }"
      :animate="{ opacity: 1, transform: 'translateY(0px)' }"
      :transition="{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }"
      @keydown="onEditKeydown"
    >
      <header class="detail-header">
        <p v-if="category && eventList" class="breadcrumb">
          <span class="bidi-auto">{{ category.title }}</span>
          <span aria-hidden="true">›</span>
          <span class="bidi-auto">{{ eventList.title }}</span>
        </p>
        <div class="detail-title-row">
          <h1 v-if="!isEditing" class="bidi-auto">{{ event.title }}</h1>
          <div v-else class="field detail-title-field">
            <label class="field-label" for="edit-title">{{ t('modals.addEvent.titleLabel') }}</label>
            <input id="edit-title" v-model="formData.title" type="text" class="input input-title" maxlength="200" />
          </div>
          <div v-if="!isEditing" class="detail-actions">
            <button class="btn btn-secondary" type="button" aria-keyshortcuts="e" @click="startEdit">
              <Pencil :size="16" aria-hidden="true" />
              {{ t('eventDetail.edit') }}
              <kbd aria-hidden="true">E</kbd>
            </button>
            <button
              class="btn btn-ghost btn-icon btn-icon-danger"
              type="button"
              :aria-label="t('eventDetail.delete')"
              :title="`${t('eventDetail.delete')} (D)`"
              aria-keyshortcuts="d"
              @click="deleteConfirm = true"
            >
              <Trash2 :size="18" aria-hidden="true" />
            </button>
          </div>
        </div>
        <span v-if="!isEditing" :class="['badge', `badge-${event.priroty}`]">{{ t('priority.' + event.priroty) }}</span>
      </header>

      <p v-if="error" class="alert-error" role="alert">{{ error }}</p>

      <!-- Read mode -->
      <dl v-if="!isEditing" class="facts">
        <div class="fact">
          <dt>{{ t('eventDetail.when') }}</dt>
          <dd v-if="sameDay">{{ formatRange(event.start_date, event.end_date) }}</dd>
          <dd v-else>
            {{ formatFull(event.start_date) }}<br />
            → {{ formatFull(event.end_date) }}
          </dd>
        </div>
        <div class="fact">
          <dt>{{ t('eventDetail.reminder') }}</dt>
          <dd>
            {{
              event.notified
                ? t('eventDetail.reminderSent')
                : t('eventDetail.reminderPending', PRIORITY_META[event.priroty].notifyDays)
            }}
          </dd>
        </div>
        <div class="fact fact-wide">
          <dt>{{ t('eventDetail.description') }}</dt>
          <dd :class="['description', 'bidi-auto', { muted: !event.description }]">
            {{ event.description || t('eventDetail.noDescription') }}
          </dd>
        </div>
      </dl>

      <!-- Edit mode -->
      <form v-else class="edit-form" @submit.prevent="handleUpdate">
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="edit-start">{{ t('eventDetail.startDate') }}</label>
            <input id="edit-start" v-model="formData.start_date" type="datetime-local" class="input" />
          </div>
          <div class="field">
            <label class="field-label" for="edit-end">{{ t('eventDetail.endDate') }}</label>
            <input
              id="edit-end"
              v-model="formData.end_date"
              type="datetime-local"
              class="input"
              :min="formData.start_date || undefined"
              :aria-invalid="formData.end_date < formData.start_date"
            />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="edit-list">{{ t('eventDetail.eventList') }}</label>
            <select id="edit-list" v-model="formData.event_list" class="input">
              <optgroup v-for="group in listsByCategory" :key="group.id" :label="group.title">
                <option v-for="list in group.lists" :key="list.id" :value="list.id">{{ list.title }}</option>
              </optgroup>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="edit-priority">{{ t('eventDetail.priority') }}</label>
            <select id="edit-priority" v-model="formData.priroty" class="input">
              <option v-for="p in [...PRIORITIES].reverse()" :key="p" :value="p">{{ t('priority.' + p) }}</option>
            </select>
          </div>
        </div>
        <label class="checkbox">
          <input v-model="formData.notified" type="checkbox" />
          <span>{{ t('eventDetail.markReminderSent') }}</span>
        </label>
        <div class="field">
          <label class="field-label" for="edit-description">{{ t('eventDetail.description') }}</label>
          <textarea
            id="edit-description"
            v-model="formData.description"
            class="input"
            rows="5"
            :placeholder="t('modals.addEvent.descriptionPlaceholder')"
          ></textarea>
        </div>
        <div class="edit-actions">
          <button class="btn btn-secondary" type="button" :disabled="saving" @click="cancelEdit">
            {{ t('eventDetail.cancel') }}
          </button>
          <button class="btn btn-primary" type="submit" :disabled="saving">
            {{ saving ? t('eventDetail.saving') : t('eventDetail.save') }}
            <kbd aria-hidden="true" dir="ltr">Ctrl+Enter</kbd>
          </button>
        </div>
      </form>
    </motion.article>

    <BaseModal
      v-if="event"
      :open="deleteConfirm"
      :title="t('eventDetail.confirmDelete')"
      size="sm"
      @close="deleteConfirm = false"
      @submit="handleDelete"
    >
      <p class="confirm-text">{{ t('eventDetail.confirmDeleteMessage', { title: event.title }) }}</p>
      <template #actions>
        <button class="btn btn-secondary" type="button" :disabled="saving" @click="deleteConfirm = false">
          {{ t('eventDetail.cancel') }}
        </button>
        <button class="btn btn-danger" type="button" :disabled="saving" @click="handleDelete">
          {{ saving ? t('eventDetail.deleting') : t('eventDetail.delete') }}
        </button>
      </template>
    </BaseModal>
  </main>
</template>
