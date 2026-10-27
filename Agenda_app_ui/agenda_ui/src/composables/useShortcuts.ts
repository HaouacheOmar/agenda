import { useEventListener } from '@vueuse/core'

export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

// Counted by BaseModal from its `open` prop, not from the DOM: a dialog that is only
// playing its exit animation must not swallow the next shortcut.
let openDialogs = 0
export const registerDialog = (open: boolean) => {
  openDialogs = Math.max(0, openDialogs + (open ? 1 : -1))
}
export const isDialogOpen = () => openDialogs > 0

/**
 * Single-key shortcuts (no modifiers). Ignored while typing in a field or while a dialog
 * is open, so they never steal input; dialogs handle their own keys (Escape, Ctrl+Enter).
 */
export function useShortcuts(map: ShortcutMap) {
  useEventListener(document, 'keydown', (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
    if (isTyping(event.target) || isDialogOpen()) return
    const handler = map[event.key] ?? map[event.key.toLowerCase()]
    if (!handler) return
    event.preventDefault()
    handler(event)
  })
}
