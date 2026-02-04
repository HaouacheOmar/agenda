<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t } = useI18n()
</script>

<template>
  <main class="page">
    <h1>{{ t('pages.eventsByList.title') }}</h1>
    <p>{{ t('pages.eventsByList.idLabel') }}: {{ route.params.eventlist_id }}</p>
    <p>{{ t('pages.eventsByList.description') }}</p>
  </main>
</template>

<style scoped>
.page {
  padding: 24px;
}
</style>
