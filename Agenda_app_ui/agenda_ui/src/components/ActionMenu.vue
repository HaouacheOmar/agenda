<script setup lang="ts">
import { nextTick, ref, useId, useTemplateRef } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { onClickOutside } from '@vueuse/core'
import type { MenuItem } from './menu'

defineProps<{ label: string; items: MenuItem[]; iconOnly?: boolean }>()
const open = ref(false)
const menuId = useId()
const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')

const menuItems = () => [...(root.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]

const show = async (focus: 'first' | 'last' = 'first') => {
  open.value = true
  await nextTick()
  const items = menuItems()
  ;(focus === 'first' ? items[0] : items[items.length - 1])?.focus()
}

const close = (refocus = true) => {
  open.value = false
  if (refocus) trigger.value?.focus()
}

const select = (item: MenuItem) => {
  close(false)
  item.onSelect()
}

const onMenuKeydown = (e: KeyboardEvent) => {
  const items = menuItems()
  const index = items.indexOf(document.activeElement as HTMLElement)
  const move = (to: number) => items[(to + items.length) % items.length]?.focus()
  if (e.key === 'ArrowDown') move(index + 1)
  else if (e.key === 'ArrowUp') move(index - 1)
  else if (e.key === 'Home') move(0)
  else if (e.key === 'End') move(items.length - 1)
  else if (e.key === 'Escape') close()
  else if (e.key === 'Tab') close(false)
  else return
  e.preventDefault()
}

onClickOutside(root, () => open.value && close(false))
</script>

<template>
  <div ref="root" class="menu">
    <button
      ref="trigger"
      :class="['btn', 'btn-secondary', { 'btn-icon': iconOnly }]"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="menuId"
      :aria-label="iconOnly ? label : undefined"
      :title="iconOnly ? label : undefined"
      @click="open ? close() : show()"
      @keydown.down.prevent="show('first')"
      @keydown.up.prevent="show('last')"
    >
      <slot name="trigger" />
    </button>

    <AnimatePresence>
      <motion.ul
        v-if="open"
        :id="menuId"
        class="menu-list"
        role="menu"
        :aria-label="label"
        :initial="{ opacity: 0, transform: 'translateY(-4px) scale(0.97)' }"
        :animate="{ opacity: 1, transform: 'translateY(0px) scale(1)' }"
        :exit="{ opacity: 0, transition: { duration: 0.1 } }"
        :transition="{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }"
        @keydown="onMenuKeydown"
      >
        <li v-for="item in items" :key="item.id" role="none">
          <button class="menu-item" type="button" role="menuitem" tabindex="-1" @click="select(item)">
            <component :is="item.icon" v-if="item.icon" :size="16" aria-hidden="true" />
            <span class="menu-item-label">{{ item.label }}</span>
            <kbd v-if="item.shortcut" aria-hidden="true">{{ item.shortcut }}</kbd>
          </button>
        </li>
      </motion.ul>
    </AnimatePresence>
  </div>
</template>

<style scoped>
.menu {
  position: relative;
}

.menu-list {
  position: absolute;
  z-index: 50;
  inset-block-start: calc(100% + 6px);
  inset-inline-end: 0;
  min-width: 240px;
  margin: 0;
  padding: var(--space-1);
  list-style: none;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-pop);
  transform-origin: top right;
}

[dir='rtl'] .menu-list {
  transform-origin: top left;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 40px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: var(--text-base);
  text-align: start;
  cursor: pointer;
}

.menu-item:focus-visible {
  outline: none;
  background: var(--surface-hover);
}

@media (hover: hover) and (pointer: fine) {
  .menu-item:hover {
    background: var(--surface-hover);
  }
}

.menu-item-label {
  flex: 1;
  white-space: nowrap;
}
</style>
