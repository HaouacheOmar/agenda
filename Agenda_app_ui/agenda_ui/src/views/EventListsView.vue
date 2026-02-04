<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <main class="page">
    <h1>{{ t('pages.eventLists.title') }}</h1>
    <p>{{ t('pages.eventLists.description') }}</p>
  </main>
</template>

<style scoped>
.page {
  padding: 24px;
}
</style>
