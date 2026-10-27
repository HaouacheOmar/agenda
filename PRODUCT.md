# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Professionals (and, later, small teams) who track projects, meetings, deadlines and personal commitments in one place. They plan at a desk on a laptop and check what is coming next on a phone between meetings.

## Product Purpose

AgendaOPS is a priority-driven agenda: every event carries a priority (low / medium / high), and the app warns earlier the more important an event is (high 3 days ahead, medium 2, low 1). Success means the user never misses an important deadline and can see at a glance what matters next.

## Positioning

A generic calendar treats every event the same. AgendaOPS ranks events by priority and turns that ranking into reminders and at-a-glance counts, so importance, not just time, drives what the user sees.

## Operating Context

- Events are organised as Category → Event list → Event (e.g. Travail → Réunions → Point client). Deleting a category or list deletes everything under it.
- Data lives in a local SQLite database served by a Django REST API; the user can export the whole database to a file and import one back (import replaces all data, a backup of the previous file is kept server-side).
- Reminders show as in-app toasts plus browser notifications while the dashboard is open; an event is then flagged as notified.

## Capabilities and Constraints

- Screens: dashboard (priority counts, month calendar, category/list filters, category tree) and an event detail page with edit and delete.
- No authentication or multi-user features exist yet; team use is a possible future direction, not a current capability.
- The priority field is named `priroty` in the API; it is load-bearing.
- Undecided: recurring events, search, sharing.

## Brand Commitments

- Name: AgendaOPS. Tagline in use: "Plan, prioritise and never miss an event."
- Bilingual: English and Arabic, with Arabic fully right-to-left. Both locales must always have the same strings.

## Evidence on Hand

No customers, testimonials, logos or metrics exist. Do not fabricate any.

## Product Principles

1. Importance before chronology: what is high priority and soon must be the most visible thing.
2. Never lose the user's data silently: destructive and replacing actions explain their consequence first.
3. One product in two directions: every layout works identically in LTR and RTL.
4. Desk and pocket: the same tasks must be comfortable on a laptop and a phone.

## Accessibility & Inclusion

Full keyboard operation, screen-reader support (labelled controls, announced status changes) and WCAG AA contrast are required.
