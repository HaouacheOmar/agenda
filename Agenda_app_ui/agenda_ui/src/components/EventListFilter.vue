<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EventList } from '../types/agenda'
import '../styles/EventListFilter.css'

const { t } = useI18n()

interface Props {
  modelValue: number | null
  eventLists: EventList[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const handleSelect = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  emit('update:modelValue', value ? parseInt(value) : null)
}
</script>

<template>
  <div class="filter-container">
    <div class="filter-content">
      <label for="event-list-select" class="filter-label">{{ t('filter.label') }}</label>
      <select
        id="event-list-select"
        :value="modelValue || ''"
        @change="handleSelect"
        class="filter-select"
      >
        <option value="">{{ t('filter.allEvents') }}</option>
        <option v-for="list in eventLists" :key="list.id" :value="list.id">
          {{ list.title }}
        </option>
      </select>
    </div>
  </div>
</template>
