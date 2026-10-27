import type { Component } from 'vue'

export interface MenuItem {
  id: string
  label: string
  icon?: Component
  shortcut?: string
  onSelect: () => void
}
