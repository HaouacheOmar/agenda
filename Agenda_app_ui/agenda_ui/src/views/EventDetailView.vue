<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import apiService from '../services/api'
import type { EventItem, EventList } from '../types/agenda'
import '../styles/EventDetailView.css'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

const event = ref<EventItem | null>(null)
const eventList = ref<EventList | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const isEditing = ref(false)
const deleteConfirm = ref(false)

const formData = ref({
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  priroty: 'medium' as 'low' | 'medium' | 'high',
  event_list: 0,
  notified: false,
})

const fetchEventDetail = async () => {
  loading.value = true
  error.value = null
  try {
    const pk = parseInt(sessionStorage.getItem('eventId') || '0')
    if (pk === 0) {
      error.value = 'Event not found'
      return
    }
    event.value = (await apiService.getEventById(pk)) as EventItem

    formData.value = {
      title: event.value.title,
      description: event.value.description,
      start_date: event.value.start_date,
      end_date: event.value.end_date,
      priroty: event.value.priroty,
      event_list:
        typeof event.value.event_list === 'number'
          ? event.value.event_list
          : event.value.event_list.id,
      notified: event.value.notified,
    }

    if (typeof event.value.event_list === 'object') {
      eventList.value = event.value.event_list
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to fetch event'
    console.error('Error fetching event:', err)
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
    await apiService.updateEvent(event.value.id, formData.value)
    isEditing.value = false
    await fetchEventDetail() // Refresh data
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to update event'
    console.error('Error updating event:', err)
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
    error.value = err instanceof Error ? err.message : 'Failed to delete event'
    console.error('Error deleting event:', err)
    loading.value = false
  }
}

const cancelEdit = () => {
  if (event.value) {
    formData.value = {
      title: event.value.title,
      description: event.value.description,
      start_date: event.value.start_date,
      end_date: event.value.end_date,
      priroty: event.value.priroty,
      event_list:
        typeof event.value.event_list === 'number'
          ? event.value.event_list
          : event.value.event_list.id,
      notified: event.value.notified,
    }
  }
  isEditing.value = false
}

const getPriorityColor = (priority: string) => {
  const colors: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#10b981',
  }
  return colors[priority] || '#3b82f6'
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
    <div v-if="loading && !event" class="loading">
      <div class="spinner"></div>
      <p>{{ t('eventDetail.loadingEvent') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error && !event" class="alert alert-error">
      {{ error }}
      <button @click="fetchEventDetail" class="btn-retry">{{ t('common.retry') }}</button>
    </div>

    <div v-else-if="event" class="detail-container">
      <div class="detail-header">
        <div>
          <button @click="router.back()" class="btn-back">← {{ t('eventDetail.back') }}</button>
          <h1 v-if="!isEditing">{{ event.title }}</h1>
          <input
            v-else
            v-model="formData.title"
            type="text"
            class="input-title"
            :placeholder="t('modals.addEvent.titlePlaceholder')"
          />
        </div>
        <div class="header-actions">
          <button v-if="!isEditing" @click="isEditing = true" class="btn-secondary">
            {{ t('eventDetail.edit') }}
          </button>
          <button v-if="!isEditing" @click="deleteConfirm = true" class="btn-danger">
            {{ t('eventDetail.delete') }}
          </button>
        </div>
      </div>

      <!-- Error Alert -->
      <div v-if="error" class="alert alert-error">
        {{ error }}
      </div>

      <!-- Event Info -->
      <div class="detail-content">
        <!-- Priority -->
        <div class="detail-field">
          <label>{{ t('eventDetail.priority') }}</label>
          <div
            v-if="!isEditing"
            class="priority-badge"
            :style="{ backgroundColor: getPriorityColor(event.priroty) }"
          >
            {{ t('priority.' + event.priroty) }}
          </div>
          <select v-else v-model="formData.priroty" class="input">
            <option value="low">{{ t('priority.low') }}</option>
            <option value="medium">{{ t('priority.medium') }}</option>
            <option value="high">{{ t('priority.high') }}</option>
          </select>
        </div>

        <div class="detail-field">
          <label>{{ t('eventDetail.startDate') }}</label>
          <p v-if="!isEditing">{{ formatDate(event.start_date) }}</p>
          <input v-else v-model="formData.start_date" type="datetime-local" class="input" />
        </div>

        <div class="detail-field">
          <label>{{ t('eventDetail.endDate') }}</label>
          <p v-if="!isEditing">{{ formatDate(event.end_date) }}</p>
          <input v-else v-model="formData.end_date" type="datetime-local" class="input" />
        </div>

        <!-- Description -->
        <div class="detail-field">
          <label>{{ t('eventDetail.description') }}</label>
          <p v-if="!isEditing" class="description">
            {{ event.description || t('eventDetail.noDescription') }}
          </p>
          <textarea
            v-else
            v-model="formData.description"
            class="input textarea"
            rows="4"
            :placeholder="t('modals.addEvent.descriptionPlaceholder')"
          ></textarea>
        </div>

        <!-- Event List -->
        <div class="detail-field" v-if="eventList">
          <label>{{ t('eventDetail.eventList') }}</label>
          <p>{{ eventList.title }}</p>
        </div>

        <div class="detail-field">
          <label>{{ t('eventDetail.notificationStatus') }}</label>
          <div
            v-if="!isEditing"
            class="status-badge"
            :class="event.notified ? 'notified' : 'not-notified'"
          >
            {{ event.notified ? t('eventDetail.notified') : t('eventDetail.notNotified') }}
          </div>
          <label v-else class="checkbox-label">
            <input type="checkbox" v-model="formData.notified" />
            <span>{{ t('eventDetail.markAsNotified') }}</span>
          </label>
        </div>
      </div>

      <!-- Edit Actions -->
      <div v-if="isEditing" class="edit-actions">
        <button @click="handleUpdate" class="btn-primary" :disabled="loading">
          {{ loading ? t('eventDetail.saving') : t('eventDetail.save') }}
        </button>
        <button @click="cancelEdit" class="btn-secondary" :disabled="loading">
          {{ t('eventDetail.cancel') }}
        </button>
      </div>

      <div v-if="deleteConfirm" class="modal-overlay" @click="deleteConfirm = false">
        <div class="modal" @click.stop>
          <h2>{{ t('eventDetail.confirmDelete') }}</h2>
          <p>{{ t('eventDetail.confirmDeleteMessage').replace('{title}', event.title) }}</p>
          <div class="modal-actions">
            <button @click="handleDelete" class="btn-danger" :disabled="loading">
              {{ loading ? t('eventDetail.deleting') : t('eventDetail.delete') }}
            </button>
            <button @click="deleteConfirm = false" class="btn-secondary" :disabled="loading">
              {{ t('eventDetail.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
