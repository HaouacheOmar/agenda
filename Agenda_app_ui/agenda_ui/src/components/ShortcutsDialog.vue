<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from './BaseModal.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const groups = computed(() => [
  {
    title: t('shortcuts.agenda'),
    rows: [
      { keys: ['N'], label: t('shortcuts.newEvent') },
      { keys: ['C'], label: t('shortcuts.newCategory') },
      { keys: ['L'], label: t('shortcuts.newList') },
      { keys: ['T'], label: t('shortcuts.today') },
      { keys: ['←', '→'], label: t('shortcuts.prevNextMonth') },
      { keys: ['0', '1', '2', '3'], label: t('shortcuts.priority') },
      { keys: ['/'], label: t('shortcuts.filters') },
      { keys: ['?'], label: t('shortcuts.help') },
    ],
  },
  {
    title: t('shortcuts.eventPage'),
    rows: [
      { keys: ['E'], label: t('shortcuts.edit') },
      { keys: ['D'], label: t('shortcuts.delete') },
      { keys: ['K', 'J'], label: t('shortcuts.prevNextEvent') },
      { keys: ['Esc'], label: t('shortcuts.back') },
    ],
  },
  {
    title: t('shortcuts.dialogs'),
    rows: [
      { keys: [isMac ? '⌘' : 'Ctrl', 'Enter'], label: t('shortcuts.save') },
      { keys: ['Esc'], label: t('shortcuts.close') },
    ],
  },
])
</script>

<template>
  <BaseModal :open="open" :title="t('shortcuts.title')" @close="emit('close')">
    <section v-for="group in groups" :key="group.title" class="group">
      <h3>{{ group.title }}</h3>
      <dl>
        <div v-for="row in group.rows" :key="row.label" class="row">
          <dt>{{ row.label }}</dt>
          <dd>
            <kbd v-for="key in row.keys" :key="key">{{ key }}</kbd>
          </dd>
        </div>
      </dl>
    </section>
  </BaseModal>
</template>

<style scoped>
.group h3 {
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  color: var(--fg-muted);
}

dl {
  margin: 0;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-2) 0;
  border-top: 1px solid var(--border);
}

dt {
  font-size: var(--text-base);
}

dd {
  display: flex;
  gap: var(--space-1);
  margin: 0;
  direction: ltr;
}
</style>
