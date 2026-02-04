<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Category } from '../types/agenda'
import '../styles/EventListFilter.css'

const { t } = useI18n()

interface Props {
  modelValue: number | null
  categories: Category[]
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
      <label for="category-select" class="filter-label">{{ t('filter.categoryLabel') }}</label>
      <select
        id="category-select"
        :value="modelValue || ''"
        @change="handleSelect"
        class="filter-select"
      >
        <option value="">{{ t('filter.allCategories') }}</option>
        <option v-for="cat in categories" :key="cat.id" :value="cat.id">
          {{ cat.title }}
        </option>
      </select>
    </div>
  </div>
</template>
