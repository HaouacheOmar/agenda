---
name: AgendaOPS
description: Priority-driven agenda; calm, keyboard-first work tool
colors:
  bg: "oklch(0.985 0.003 255)"
  surface: "oklch(1 0 0)"
  surface-sunken: "oklch(0.967 0.005 255)"
  surface-hover: "oklch(0.955 0.007 255)"
  border: "oklch(0.915 0.008 255)"
  border-strong: "oklch(0.85 0.012 255)"
  fg: "oklch(0.23 0.02 262)"
  fg-muted: "oklch(0.44 0.02 262)"
  fg-subtle: "oklch(0.52 0.018 262)"
  accent: "oklch(0.47 0.17 266)"
  accent-hover: "oklch(0.41 0.17 266)"
  accent-fg: "oklch(0.99 0.005 266)"
  accent-soft: "oklch(0.95 0.03 266)"
  danger: "oklch(0.53 0.2 25)"
  prio-high: "oklch(0.53 0.19 25)"
  prio-high-soft: "oklch(0.955 0.035 25)"
  prio-medium: "oklch(0.52 0.12 65)"
  prio-medium-soft: "oklch(0.96 0.05 85)"
  prio-low: "oklch(0.5 0.1 165)"
  prio-low-soft: "oklch(0.955 0.035 165)"
typography:
  title:
    fontFamily: "Geist, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    letterSpacing: "-0.015em"
  section:
    fontFamily: "Geist, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
  body:
    fontFamily: "Geist, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "0.9375rem"
    lineHeight: 1.5
  label:
    fontFamily: "Geist, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
  meta:
    fontFamily: "Geist, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "0.75rem"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.md}"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "40px"
  chip:
    rounded: "{rounded.pill}"
    height: "32px"
---

## Overview

A calm, precise work tool for professionals tracking deadlines. Light by default (desk, daylight); a separately composed dark theme follows the OS (`prefers-color-scheme`). Importance before chronology: the dashboard leads with "Up next" (Today / Tomorrow / This week / Later) filtered by priority chips, beside a month calendar, with the Category → List structure below. Keyboard-first: every frequent action has a single-key shortcut, shown as `<kbd>` hints and in a `?` help dialog. Tokens live in `Agenda_app_ui/agenda_ui/src/styles/base.css`; dark values are redefined there under the media query.

## Colors

Restrained: tinted cool neutrals plus one ink-indigo accent used only for the primary action, focus, selection and "today". Priority is the only other color, always as a soft tint with a strong text color plus a dot and a word, never color alone. No gradients, no glows. All text pairs meet WCAG AA in both themes.

## Typography

One family, Geist, for every role; IBM Plex Sans Arabic replaces it under `[lang='ar']`. Fixed rem scale (1.2 ratio): 12 meta, 13 labels, 15 UI body, 16 prose, 18 section titles, 24/30 page titles. Times and counts use tabular numerals. Headings `text-wrap: balance`; user-entered titles use `unicode-bidi: plaintext` (`.bidi-auto`) so Latin titles read correctly in Arabic.

## Layout

Max width 1440px. Desktop: 380px "Up next" column (sticky, spanning both rows) beside calendar and categories. ≤1024px: single column in reading order Up next → calendar → categories. ≤640px: the calendar switches to FullCalendar's list view, modals become bottom sheets, and a 56px round "New event" button sits bottom inline-end within thumb reach. Spacing on a 4px scale.

## Elevation & Depth

Flat surfaces separated by 1px borders. Only floating layers (menus, modals, toasts, FAB) carry `--shadow-pop`, an offset soft shadow.

## Shapes

Cards 12px, controls 8px, pills only for chips and badges.

## Components

- Buttons `.btn` + `.btn-primary | .btn-secondary | .btn-ghost | .btn-danger`; `.btn-icon` 40px, `.btn-icon-sm` 32px visible with a 44px hit area. Press feedback `scale(0.97)`; hover only on `(hover: hover)` devices.
- `ActionMenu` (menu button pattern: arrow keys, Home/End, Escape, click outside) for "New ▾" and "⋯ More".
- `BaseModal`: focus moves in (first field, or Cancel in confirmations), Tab is trapped, focus returns to the trigger, Escape closes, Ctrl/⌘+Enter submits. Destructive and replacing actions always confirm with their consequence in numbers.
- Toasts bottom inline-end: reminders persist until dismissed or opened (only then marked sent); feedback toasts leave after 5s.

## Motion

Motion conveys state only, 150–250ms, `cubic-bezier(0.23, 1, 0.32, 1)`, exits faster than entrances, transforms via full `transform` strings: modal and menu scale from 0.97, toasts rise 12px, agenda rows fade on filter changes. No page-load choreography. `MotionConfig reduced-motion="user"` plus a CSS reduced-motion guard.

## Do's and Don'ts

- Do use logical properties (`inset-inline-*`, `margin-inline-*`) and mirror directional icons with `.flip-rtl`.
- Do add every new string to both `en.ts` and `ar.ts`.
- Do give every new frequent action a shortcut via `useShortcuts` and list it in `ShortcutsDialog`.
- Don't use colored side borders, gradients, glows or nested cards.
- Don't put `ref` on `motion.*` elements; use a plain element.
