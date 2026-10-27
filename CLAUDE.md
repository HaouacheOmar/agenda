# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

Two independent projects, no shared tooling:

- `Agenda_app/agenda_web_app/` — Django 6 + Django REST Framework backend (SQLite, `db.sqlite3` next to `manage.py`).
- `Agenda_app_ui/agenda_ui/` — Vue 3 (beta, pinned via `overrides`) + Vite + TypeScript frontend.

## Commands

Backend (run from `Agenda_app/agenda_web_app/`):

```sh
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver        # serves on :8000, frontend expects this
python manage.py makemigrations
python manage.py test             # all apps
python manage.py test event.tests.SomeTestCase.test_method   # single test
```

`SECRET_KEY` is loaded from `.env` via python-dotenv. `DB_PATH` overrides the SQLite file (used by the e2e suite). Tests are DRF `APITestCase`s in each app's `tests.py`; `Agenda_app/tests.py` covers SQLite import/export by patching `get_sqlite_db_path` to a temp file.

Frontend (run from `Agenda_app_ui/agenda_ui/`):

```sh
npm install
npm run dev          # Vite on :5173 (the only origins allowed by CORS)
npm run build        # type-check (vue-tsc) + vite build in parallel
npm run type-check
npm run format       # prettier on src/
npm run test:unit    # Vitest (jsdom), src/**/*.test.ts
npx vitest run src/services/api.test.ts -t "DRF"     # single file / test name
npm run test:e2e     # Playwright, e2e/*.spec.ts
npx playwright test -g "event detail"                # single e2e test
```

The e2e suite starts its own servers (Django on 8001 with `DB_PATH=node_modules/.tmp/e2e.sqlite3`, recreated each run; Vite on 5174) and uses the locally installed Chrome (`channel: 'chrome'`), so it never touches `db.sqlite3` or the dev servers. jsdom is pinned to 26 because newer versions don't support Node 23. New dev deps may need `npm i --legacy-peer-deps` (npm 10.9 arborist crash with the `vue: beta` overrides).

## Architecture

**Backend.** Plain `APIView` classes (no ViewSets/routers), no auth enforced; missing objects go through `get_object_or_404`. Data model:
`Category` → `Event_list` (FK `category`, CASCADE) → `Event` (FK `event_list`, `related_name="events"`, CASCADE). Deleting a category or event list cascades to its events.

- The `Event` priority field is spelled **`priroty`** (values `low`/`medium`/`high`). This name is in the DB schema, serializers, and frontend payloads — don't "fix" it in one place only.
- URL prefixes: `/event/...` (event lists, events, by-eventlist, by-priority), `/category/categories/...`, and `/data/export-sqlite/` + `/data/import-sqlite/` in [Agenda_app/db_tools_views.py](Agenda_app/agenda_web_app/Agenda_app/db_tools_views.py).
- `APPEND_SLASH = False` and trailing slashes are inconsistent between routes (e.g. `events/<pk>` has none, `eventlists/<pk>/` has one). The frontend URL must match exactly — check `event/urls.py` / `category/urls.py` when adding or calling endpoints.
- SQLite import replaces the live DB file: it validates the upload contains `REQUIRED_TABLES`, backs up the current file, closes Django connections, and swaps the file in. New tables that must survive an import/export round-trip belong in `REQUIRED_TABLES`.

**Frontend.** Two routes ([src/router/index.ts](Agenda_app_ui/agenda_ui/src/router/index.ts)): the dashboard (`/`) and `/events/:id` (event detail, id passed as a prop). All HTTP goes through [src/services/api.ts](Agenda_app_ui/agenda_ui/src/services/api.ts) (base URL `VITE_API_URL`, default `http://localhost:8000`); it turns Django `{err}` / DRF field errors into thrown `Error`s.

- [src/types/agenda.ts](Agenda_app_ui/agenda_ui/src/types/agenda.ts) holds the API types plus the shared helpers: `PRIORITY_META` (priority colors + notify-days — use it instead of re-mapping priorities), `idOf` (FKs may be an id or a nested object), and `toLocalInput`/`toIso` — always convert when binding API dates to `<input type="datetime-local">` and when sending them back, or times shift by the timezone offset.
- i18n: `vue-i18n` (composition mode) with `en` and `ar` in `src/locales/`. Every user-facing string needs a key in **both** locale files. Locale persistence and `<html dir/lang>` live in `applyLocale` (`src/i18n/index.ts`); Arabic is RTL, so use logical CSS properties (`inset-inline-end`, `border-inline-start`).
- Calendar is FullCalendar (daygrid) wrapped in `components/FullCalendar.vue`.
- Styling: OKLCH token system in `src/styles/base.css` (light default, dark via `prefers-color-scheme`; `.btn`, `.input`, `.field`, `.card`, `.badge`, `kbd`) plus per-view CSS in `src/styles/`; no CSS framework. Visual rules live in root `DESIGN.md`, product truth in `PRODUCT.md`. Icons come from `@lucide/vue`. Modals go through `components/BaseModal.vue`, dropdowns through `components/ActionMenu.vue`.
- Keyboard shortcuts: `useShortcuts(map)` (ignored while typing or while a `BaseModal` is open; modals register themselves via `registerDialog`). New shortcuts must also be listed in `components/ShortcutsDialog.vue`.
- Animations use `motion-v` (`motion.*`, `AnimatePresence`); `App.vue` wraps everything in `MotionConfig reduced-motion="user"`. A template `ref` on a `motion.*` element returns the component, not the DOM node — put refs on plain elements.
