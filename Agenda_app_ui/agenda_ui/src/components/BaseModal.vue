<script setup lang="ts">
import { nextTick, useId, useTemplateRef, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useEventListener } from '@vueuse/core'
import { X } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ open: boolean; title: string; error?: string | null }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const titleId = useId()
// Plain element ref: a ref on motion.div would give the component, not the DOM node.
const body = useTemplateRef<HTMLElement>('body')

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (props.open && e.key === 'Escape') emit('close')
})

// Move focus into the dialog when it opens, so keyboard users land on the first field.
watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    const dialog = body.value?.closest('[role="dialog"]')
    const target =
      body.value?.querySelector<HTMLElement>('input, select, textarea') ??
      dialog?.querySelector<HTMLElement>('.modal-actions button') // Cancel, never the destructive action
    target?.focus()
  },
)
</script>

<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="open"
        class="modal-overlay"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0, transition: { duration: 0.15 } }"
        :transition="{ duration: 0.2 }"
        @click.self="emit('close')"
      >
        <motion.div
          class="modal"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :initial="{ opacity: 0, scale: 0.94, y: 16 }"
          :animate="{ opacity: 1, scale: 1, y: 0 }"
          :exit="{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.15 } }"
          :transition="{ type: 'spring', bounce: 0.2, visualDuration: 0.35 }"
        >
          <header class="modal-header">
            <h2 :id="titleId">{{ title }}</h2>
            <button class="btn btn-ghost btn-icon-sm" type="button" :aria-label="t('common.close')" @click="emit('close')">
              <X :size="18" aria-hidden="true" />
            </button>
          </header>

          <p v-if="error" class="alert-error" role="alert">{{ error }}</p>

          <div ref="body" class="modal-body">
            <slot />
          </div>

          <footer class="modal-actions">
            <slot name="actions" />
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(4, 5, 12, 0.7);
  backdrop-filter: blur(6px);
}

.modal {
  width: min(480px, 100%);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  background: var(--color-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.modal-header h2 {
  font-size: 20px;
  font-weight: 600;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
