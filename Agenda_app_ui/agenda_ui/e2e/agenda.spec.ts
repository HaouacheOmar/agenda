import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import fs from 'node:fs'

// Backend started by playwright.config.ts on a throwaway database.
const API = 'http://127.0.0.1:8001'

const pad = (n: number) => String(n).padStart(2, '0')
// Value format of <input type="datetime-local">, in the browser's (Africa/Algiers) local time.
const localInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const uid = () => Math.random().toString(36).slice(2, 7)

async function post<T>(request: APIRequestContext, path: string, data: object): Promise<T> {
  const res = await request.post(API + path, { data })
  expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy()
  return res.json()
}

// Category -> list -> event, created through the API so UI tests start from known data.
async function seed(request: APIRequestContext, { daysAhead = 10, priority = 'medium' } = {}) {
  const tag = uid()
  const category = await post<{ id: number; title: string }>(request, '/category/categories/', { title: `Cat ${tag}` })
  const list = await post<{ id: number; title: string }>(request, '/event/eventlists/', {
    title: `List ${tag}`,
    category: category.id,
  })
  const start = new Date(Date.now() + daysAhead * 864e5)
  start.setSeconds(0, 0) // datetime-local inputs are minute precision
  const event = await post<{ id: number; title: string }>(request, '/event/events/', {
    title: `Event ${tag}`,
    description: 'Seeded by e2e',
    event_list: list.id,
    priroty: priority,
    start_date: start.toISOString(),
    end_date: new Date(start.getTime() + 36e5).toISOString(),
    notified: false,
  })
  return { category, list, event }
}

const totalKpi = async (page: Page) => Number(await page.locator('.tile-kpi .meter-value').first().innerText())

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('locale', 'en'))
  page.on('dialog', (dialog) => dialog.accept()) // confirm() before deletes / import
})

test('create category, event list and event through the modals', async ({ page, request }) => {
  const tag = uid()
  await page.goto('/')
  const before = await totalKpi(page)

  await page.getByRole('button', { name: 'Category', exact: true }).click()
  await expect(page.locator('#new-category-title')).toBeFocused()
  await page.locator('#new-category-title').fill(`Cat ${tag}`)
  await page.locator('#new-category-title').press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.tree-category h3', { hasText: `Cat ${tag}` })).toBeVisible()

  await page.getByRole('button', { name: 'Event List', exact: true }).click()
  await page.locator('#new-list-title').fill(`List ${tag}`)
  await page.locator('#new-list-category').selectOption({ label: `Cat ${tag}` })
  await page.getByRole('button', { name: 'Create Event List' }).click()
  await expect(page.locator('.tree-list h4', { hasText: `List ${tag}` })).toBeVisible()

  await page.getByRole('button', { name: 'Add Event' }).click()
  await page.getByRole('button', { name: 'Create Event' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Please fill in')

  const start = new Date(Date.now() + 2 * 864e5)
  start.setHours(10, 0, 0, 0)
  const end = new Date(start.getTime() + 36e5)
  await page.locator('#new-event-title').fill(`Event ${tag}`)
  await page.locator('#new-event-start').fill(localInput(end))
  await page.locator('#new-event-end').fill(localInput(start))
  await page.locator('#new-event-list').selectOption({ label: `List ${tag}` })
  await page.getByRole('button', { name: 'Create Event' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('End date')

  await page.locator('#new-event-start').fill(localInput(start))
  await page.locator('#new-event-end').fill(localInput(end))
  await page.locator('#new-event-priority').selectOption('high')
  await page.getByRole('button', { name: 'Create Event' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.event-row-title', { hasText: `Event ${tag}` })).toBeVisible()
  await expect.poll(() => totalKpi(page)).toBe(before + 1)

  // Stored at the right instant (no timezone shift).
  const events: Array<{ title: string; start_date: string; notified: boolean }> = await (
    await request.get(`${API}/event/events/`)
  ).json()
  const created = events.find((e) => e.title === `Event ${tag}`)!
  expect(new Date(created.start_date).getTime()).toBe(start.getTime())

  // High priority in 2 days -> toast, and the event is marked notified once.
  await expect(page.locator('.toast', { hasText: `Event ${tag}` })).toBeVisible()
  await expect
    .poll(async () => (await (await request.get(`${API}/event/events/`)).json()).find((e: { title: string }) => e.title === `Event ${tag}`).notified)
    .toBe(true)
})

test('Escape and the close button dismiss a modal', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add Event' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: 'Event List', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('category and list filters narrow the dashboard and stay consistent', async ({ page, request }) => {
  const { category, list } = await seed(request)
  await page.goto('/')
  const all = await totalKpi(page)

  await page.locator('#dashboard-category-filter').selectOption({ label: category.title })
  await expect.poll(() => totalKpi(page)).toBe(1)
  await expect(page.locator('.tree-category')).toHaveCount(1)

  await page.locator('#dashboard-category-filter').selectOption('')
  await page.locator('#dashboard-eventlist-filter').selectOption({ label: list.title })
  // Picking a list selects its category.
  await expect(page.locator('#dashboard-category-filter')).toHaveValue(String(category.id))
  await expect.poll(() => totalKpi(page)).toBe(1)

  await page.locator('#dashboard-category-filter').selectOption('')
  await page.locator('#dashboard-eventlist-filter').selectOption('')
  await expect.poll(() => totalKpi(page)).toBe(all)
})

test('event detail: deep link, edit in local time, cancel, delete', async ({ page, request }) => {
  const { list, event } = await seed(request)
  await page.goto(`/#/events/${event.id}`)
  await expect(page.locator('.detail h1')).toHaveText(event.title)
  await expect(page.locator('.info-value', { hasText: list.title })).toBeVisible()

  const stored = await (await request.get(`${API}/event/events/${event.id}`)).json()
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(page.locator('#edit-start')).toHaveValue(localInput(new Date(stored.start_date)))

  await page.locator('#edit-title').fill('should not stick')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('.detail h1')).toHaveText(event.title)

  await page.getByRole('button', { name: 'Edit' }).click()
  const newEnd = new Date(new Date(stored.end_date).getTime() + 2 * 36e5)
  await page.locator('#edit-title').fill(`${event.title} edited`)
  await page.locator('#edit-end').fill(localInput(newEnd))
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.locator('.detail h1')).toHaveText(`${event.title} edited`)
  const saved = await (await request.get(`${API}/event/events/${event.id}`)).json()
  expect(new Date(saved.end_date).getTime()).toBe(newEnd.getTime())

  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.locator('.confirm-text')).toContainText(`"${event.title} edited"`)
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/#\/$/)
  expect((await request.get(`${API}/event/events/${event.id}`)).status()).toBe(404)
})

test('unknown event id shows an error and Back returns to the dashboard', async ({ page }) => {
  await page.goto('/#/events/999999')
  await expect(page.getByRole('alert')).toContainText('No Event matches')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page).toHaveURL(/#\/$/)
})

test('calendar event opens its detail page', async ({ page, request }) => {
  const { event } = await seed(request, { daysAhead: 0 })
  await page.goto('/')
  await page.locator('.fc-daygrid-event', { hasText: event.title }).click()
  await expect(page).toHaveURL(new RegExp(`#/events/${event.id}$`))
})

test('delete event list and category from the hierarchy', async ({ page, request }) => {
  const { category, list } = await seed(request)
  await page.goto('/')
  await page.getByRole('button', { name: `Delete List: ${list.title}` }).click()
  await expect(page.locator('.tree-list h4', { hasText: list.title })).toHaveCount(0)
  await page.getByRole('button', { name: `Delete Category: ${category.title}` }).click()
  await expect(page.locator('.tree-category h3', { hasText: category.title })).toHaveCount(0)
})

test('language switch toggles Arabic RTL and is remembered', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Switch language' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('.fc-toolbar-title')).toHaveText(/[؀-ۿ]/)
  expect(await page.evaluate(() => localStorage.getItem('locale'))).toBe('ar')

  await page.getByRole('button', { name: 'تغيير اللغة' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
})

test('export then re-import the database', async ({ page }, testInfo) => {
  await page.goto('/')
  const before = await totalKpi(page)

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()])
  const file = testInfo.outputPath('export.sqlite3')
  await download.saveAs(file)
  expect(fs.readFileSync(file).subarray(0, 15).toString()).toBe('SQLite format 3')
  await expect(page.locator('.toast', { hasText: 'exported successfully' })).toBeVisible()

  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.locator('.toast', { hasText: 'imported successfully' })).toBeVisible()
  await expect.poll(() => totalKpi(page)).toBe(before)

  const bad = testInfo.outputPath('bad.sqlite3')
  fs.writeFileSync(bad, 'not a database')
  await page.locator('input[type=file]').setInputFiles(bad)
  await expect(page.locator('.toast', { hasText: 'not a valid SQLite database' })).toBeVisible()
})

test('mobile layout has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  await expect(page.locator('.tile-kpi').first()).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
