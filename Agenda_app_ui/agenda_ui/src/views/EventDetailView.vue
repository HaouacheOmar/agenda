<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { motion } from 'motion-v'
import { ArrowLeft, Bell, BellOff, CalendarClock, FolderOpen, Pencil, Trash2 } from '@lucide/vue'
import apiService from '../services/api'
import BaseModal from '../components/BaseModal.vue'
import { PRIORITIES, idOf, toIso, toLocalInput } from '../types/agenda'
import type { EventItem, EventList } from '../types/agenda'
import '../styles/EventDetailView.css'

const props = defineProps<{ id: number }>()

const { t, locale } = useI18n()
const router = useRouter()

const event = ref<EventItem | null>(null)
const eventLists = ref<EventList[]>([])
// The API returns event_list as an id; resolve it against the loaded lists.
const eventList = computed(() => {
  const listRef = event.value?.event_list
  if (!listRef) return null
  return typeof listRef === 'object' ? listRef : (eventLists.value.find((l) => l.id === listRef) ?? null)
})
const loading = ref(false)
const error = ref<string | null>(null)
const isEditing = ref(false)
const deleteConfirm = ref(false)

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
  try {
    const [e, lists] = await Promise.all([apiService.getEventById(props.id), apiService.getEventLists()])
    eventLists.value = lists
    setEvent(e)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

const handleUpdate = async () => {
  if (!event.value) return

  if (new Date(formData.value.end_date) < new Date(formData.value.start_date)) {
    error.value = t('modals.addEvent.dateOrderError')
    return
  }

  loading.value = true
  error.value = null
  try {
    setEvent(
      await apiService.updateEvent(event.value.id, {
        ...formData.value,
        start_date: toIso(formData.value.start_date),
        end_date: toIso(formData.value.end_date),
      }),
    )
    isEditing.value = false
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

const handleDelete = async () => {
  if (!event.value) return

  loading.value = true
  error.value = null
  try {
    await apiService.deleteEvent(event.value.id)
    router.push({ name: 'dashboard' })
  } catch (err) {
    error.value = errorMessage(err)
    loading.value = false
  }
}

const cancelEdit = () => {
  if (event.value) formData.value = toForm(event.value)
  isEditing.value = false
}

const formatDate = (dateString: string) => {
  const localeCode = locale.value === 'ar' ? 'ar-DZ' : 'en-US'
  return new Date(dateString).toLocaleDateString(localeCode, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(fetchEventDetail)
</script>

<template>
  <main class="event-detail">
    <button class="btn btn-ghost back" type="button" @click="router.push({ name: 'dashboard' })">
      <ArrowLeft :size="18" class="back-icon" aria-hidden="true" />
      {{ t('eventDetail.back') }}
    </button>

    <div v-if="loading && !event" class="card state">
      <span class="spinner" aria-hidden="true"></span>
      <p>{{ t('eventDetail.loadingEvent') }}</p>
    </div>

    <div v-else-if="error && !event" class="alert-error" role="alert">
      {{ error }}
      <button class="btn btn-secondary" type="button" @click="fetchEventDetail">{{ t('common.retry') }}</button>
    </div>

    <motion.article
      v-else-if="event"
      :class="['card', 'detail', `detail-${event.priroty}`]"
      :initial="{ opacity: 0, y: 20 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }"
    >
      <header class="detail-header">
        <div class="detail-heading">
          <span :class="['badge', `badge-${event.priroty}`]">{{ t('priority.' + event.priroty) }}</span>
          <h1 v-if="!isEditing">{{ event.title }}</h1>
          <div v-else class="field">
            <label class="field-label" for="edit-title">{{ t('modals.addEvent.titleLabel') }}</label>
            <input
              id="edit-title"
              v-model="formData.title"
              type="text"
              class="input input-title"
              :placeholder="t('modals.addEvent.titlePlaceholder')"
            />
          </div>
        </div>
        <div v-if="!isEditing" class="detail-actions">
          <button class="btn btn-secondary" type="button" @click="isEditing = true">
            <Pencil :size="16" aria-hidden="true" />
            {{ t('eventDetail.edit') }}
          </button>
          <button class="btn btn-ghost btn-icon btn-icon-danger" type="button" :aria-label="t('eventDetail.delete')" :title="t('eventDetail.delete')" @click="deleteConfirm = true">
            <Trash2 :size="18" aria-hidden="true" />
          </button>
        </div>
      </header>

      <p v-if="error" class="alert-error" role="alert">{{ error }}</p>

      <!-- Read mode -->
      <div v-if="!isEditing" class="detail-grid">
        <div class="info">
          <CalendarClock :size="18" class="info-icon" aria-hidden="true" />
          <div>
            <span class="info-label">{{ t('eventDetail.startDate') }}</span>
            <span class="info-value">{{ formatDate(event.start_date) }}</span>
          </div>
        </div>
        <div class="info">
          <CalendarClock :size="18" class="info-icon" aria-hidden="true" />
          <div>
            <span class="info-label">{{ t('eventDetail.endDate') }}</span>
            <span class="info-value">{{ formatDate(event.end_date) }}</span>
          </div>
        </div>
        <div v-if="eventList" class="info">
          <FolderOpen :size="18" class="info-icon" aria-hidden="true" />
          <div>
            <span class="info-label">{{ t('eventDetail.eventList') }}</span>
            <span class="info-value">{{ eventList.title }}</span>
          </div>
        </div>
        <div class="info">
          <component :is="event.notified ? Bell : BellOff" :size="18" class="info-icon" aria-hidden="true" />
          <div>
            <span class="info-label">{{ t('eventDetail.notificationStatus') }}</span>
            <span class="info-value">{{ event.notified ? t('eventDetail.notified') : t('eventDetail.notNotified') }}</span>
          </div>
        </div>
        <div class="info info-wide">
          <div>
            <span class="info-label">{{ t('eventDetail.description') }}</span>
            <p class="description">{{ event.description || t('eventDetail.noDescription') }}</p>
          </div>
        </div>
      </div>

      <!-- Edit mode -->
      <form v-else class="edit-form" @submit.prevent="handleUpdate">
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="edit-priority">{{ t('eventDetail.priority') }}</label>
            <select id="edit-priority" v-model="formData.priroty" class="input">
              <option v-for="p in PRIORITIES" :key="p" :value="p">{{ t('priority.' + p) }}</option>
            </select>
          </div>
          <label class="checkbox">
            <input v-model="formData.notified" type="checkbox" />
            <span>{{ t('eventDetail.markAsNotified') }}</span>
          </label>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="edit-start">{{ t('eventDetail.startDate') }}</label>
            <input id="edit-start" v-model="formData.start_date" type="datetime-local" class="input" />
          </div>
          <div class="field">
            <label class="field-label" for="edit-end">{{ t('eventDetail.endDate') }}</label>
            <input id="edit-end" v-model="formData.end_date" type="datetime-local" class="input" />
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="edit-description">{{ t('eventDetail.description') }}</label>
          <textarea
            id="edit-description"
            v-model="formData.description"
            class="input"
            rows="4"
            :placeholder="t('modals.addEvent.descriptionPlaceholder')"
          ></textarea>
        </div>
        <div class="edit-actions">
          <button class="btn btn-secondary" type="button" :disabled="loading" @click="cancelEdit">
            {{ t('eventDetail.cancel') }}
          </button>
          <button class="btn btn-primary" type="submit" :disabled="loading">
            {{ loading ? t('eventDetail.saving') : t('eventDetail.save') }}
          </button>
        </div>
      </form>
    </motion.article>

    <BaseModal v-if="event" :open="deleteConfirm" :title="t('eventDetail.confirmDelete')" @close="deleteConfirm = false">
      <p class="confirm-text">{{ t('eventDetail.confirmDeleteMessage', { title: event.title }) }}</p>
      <template #actions>
        <button class="btn btn-secondary" type="button" :disabled="loading" @click="deleteConfirm = false">
          {{ t('eventDetail.cancel') }}
        </button>
        <button class="btn btn-danger" type="button" :disabled="loading" @click="handleDelete">
          {{ loading ? t('eventDetail.deleting') : t('eventDetail.delete') }}
        </button>
      </template>
    </BaseModal>
  </main>
</template>
