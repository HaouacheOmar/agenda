import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const backendDir = fileURLToPath(new URL('../../Agenda_app/agenda_web_app', import.meta.url))
// Throwaway database, recreated on every run so the real db.sqlite3 is never touched.
const e2eDb = fileURLToPath(new URL('./node_modules/.tmp/e2e.sqlite3', import.meta.url))
const API_URL = 'http://127.0.0.1:8001'
const APP_URL = 'http://localhost:5174'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: APP_URL,
    // Uses the locally installed Chrome, no browser download needed.
    channel: 'chrome',
    timezoneId: 'Africa/Algiers',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'python -c "import os,sys; p=sys.argv[1]; os.makedirs(os.path.dirname(p), exist_ok=True); os.path.exists(p) and os.remove(p)" "' +
        e2eDb +
        '" && python manage.py migrate --noinput && python manage.py runserver 8001 --noreload',
      cwd: backendDir,
      env: { DB_PATH: e2eDb },
      url: `${API_URL}/event/events/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      env: { VITE_API_URL: API_URL },
      url: APP_URL,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
