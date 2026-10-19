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

`SECRET_KEY` is loaded from `.env` via python-dotenv. API tests live in `event/tests.py` (DRF `APITestCase`).

Frontend (run from `Agenda_app_ui/agenda_ui/`):

```sh
npm install
npm run dev          # Vite on :5173 (the only origins allowed by CORS)
npm run build        # type-check (vue-tsc) + vite build in parallel
npm run type-check
npm run format       # prettier on src/
```

No test runner or linter is configured for the frontend.

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
- Calendar is FullCalendar (daygrid) wrapped in `components/FullCalendar.vue`; styling is plain per-view CSS in `src/styles/` (no CSS framework).
