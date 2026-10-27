<script setup lang="ts">
import { nextTick, onUnmounted, useId, useTemplateRef, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useEventListener } from '@vueuse/core'
import { X } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { registerDialog } from '../composables/useShortcuts'

const props = defineProps<{ open: boolean; title: string; error?: string | null; size?: 'sm' | 'md' }>()
const emit = defineEmits<{ close: []; submit: [] }>()
const { t } = useI18n()
const titleId = useId()
// Plain element ref: a ref on motion.div would give the component, not the DOM node.
const body = useTemplateRef<HTMLElement>('body')
let returnFocusTo: HTMLElement | null = null

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const dialog = () => body.value?.closest<HTMLElement>('[role="dialog"]') ?? null

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    emit('submit')
  } else if (e.key === 'Tab') {
    // Keep focus inside the dialog.
    const items = [...(dialog()?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    if (!items.length) return
    const first = items[0]!
    const last = items[items.length - 1]!
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
})

onUnmounted(() => props.open && registerDialog(false))

watch(
  () => props.open,
  async (open) => {
    registerDialog(open)
    if (open) {
      returnFocusTo = document.activeElement as HTMLElement | null
      await nextTick()
      // First field, or Cancel (never the destructive action) in a confirmation.
      const target =
        body.value?.querySelector<HTMLElement>('input, select, textarea') ??
        dialog()?.querySelector<HTMLElement>('.modal-actions button')
      target?.focus()
    } else if (returnFocusTo?.isConnected) {
      returnFocusTo.focus()
      returnFocusTo = null
    }
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
        :exit="{ opacity: 0, transition: { duration: 0.12 } }"
        :transition="{ duration: 0.18 }"
        @click.self="emit('close')"
      >
        <motion.div
          :class="['modal', `modal-${size ?? 'md'}`]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :initial="{ opacity: 0, transform: 'translateY(8px) scale(0.97)' }"
          :animate="{ opacity: 1, transform: 'translateY(0px) scale(1)' }"
          :exit="{ opacity: 0, transform: 'translateY(4px) scale(0.98)', transition: { duration: 0.12 } }"
          :transition="{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }"
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

          <footer v-if="$slots.actions" class="modal-actions">
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
  padding: var(--space-4);
  background: var(--scrim);
}

.modal {
  width: min(520px, 100%);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop);
}

.modal-sm {
  width: min(420px, 100%);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.modal-header h2 {
  font-size: var(--text-lg);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--space-2);
}

@media (max-width: 640px) {
  .modal-overlay {
    place-items: end stretch;
    padding: 0;
  }

  .modal {
    width: 100%;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    padding: var(--space-5) var(--space-4) calc(var(--space-5) + env(safe-area-inset-bottom));
  }

  .modal-actions .btn {
    flex: 1;
  }
}
</style>
