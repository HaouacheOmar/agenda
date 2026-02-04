<script setup lang="ts">
import { useLocale } from '../composables/useLocale'

const { locale, toggleLocale } = useLocale()
</script>

<template>
  <button class="language-toggle" @click="toggleLocale" :aria-label="locale === 'en' ? 'Switch to Arabic' : 'Switch to English'">
    <span class="flag">{{ locale === 'en' ? '🇸🇦' : '🇬🇧' }}</span>
    <span class="lang-code">{{ locale === 'en' ? 'AR' : 'EN' }}</span>
  </button>
</template>

<style scoped>
.language-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background-color: white;
  color: #1f2937;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
}

.language-toggle:hover {
  background-color: #f3f4f6;
  border-color: #3b82f6;
}

.flag {
  font-size: 18px;
}

.lang-code {
  font-weight: 600;
}
</style>