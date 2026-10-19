<script setup lang="ts">
import { Languages } from '@lucide/vue'
import { useLocale } from '../composables/useLocale'

const { locale, toggleLocale, t } = useLocale()
</script>

<template>
  <button class="btn btn-secondary" type="button" :aria-label="t('common.switchLanguage')" @click="toggleLocale">
    <Languages :size="18" aria-hidden="true" />
    <span>{{ locale === 'en' ? 'العربية' : 'English' }}</span>
  </button>
</template>
