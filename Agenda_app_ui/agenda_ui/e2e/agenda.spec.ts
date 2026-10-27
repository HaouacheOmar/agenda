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

const getEvents = async (request: APIRequestContext) =>
  (await (await request.get(`${API}/event/events/`)).json()) as Array<{ id: number; title: string; start_date: string; notified: boolean }>

// "All N" chip: number of upcoming events in the current scope (after the first load).
const upcomingCount = async (page: Page) => {
  await expect(page.locator('.agenda-skeleton')).toHaveCount(0)
  return Number(await page.locator('.chip').first().locator('.chip-count').innerText())
}
const dialog = (page: Page) => page.getByRole('dialog')
const openMore = (page: Page) => page.getByRole('button', { name: 'More' }).click()

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('locale', 'en'))
})

test('create category, event list and event (menu, shortcut, validation, reminder)', async ({ page, request }) => {
  const tag = uid()
  await page.goto('/')
  const before = await upcomingCount(page)

  // Category through the "New" menu, submitted with Ctrl+Enter.
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByRole('menuitem', { name: /Category/ }).click()
  await expect(page.locator('#new-category-title')).toBeFocused()
  await page.locator('#new-category-title').fill(`Cat ${tag}`)
  await page.keyboard.press('Control+Enter')
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.locator('.organize-category h3', { hasText: `Cat ${tag}` })).toBeVisible()

  // List through the L shortcut.
  await page.keyboard.press('l')
  await page.locator('#new-list-title').fill(`List ${tag}`)
  await page.locator('#new-list-category').selectOption({ label: `Cat ${tag}` })
  await page.getByRole('button', { name: 'Create list' }).click()
  await expect(page.locator('.organize-list-btn', { hasText: `List ${tag}` })).toBeVisible()

  // Event through the N shortcut.
  await page.keyboard.press('n')
  await page.getByRole('button', { name: 'Create event' }).click()
  await expect(dialog(page).getByRole('alert')).toContainText('Fill in the title')
  await expect(page.locator('#new-event-title')).toHaveAttribute('aria-invalid', 'true')

  const start = new Date(Date.now() + 2 * 864e5)
  start.setHours(10, 0, 0, 0)
  const end = new Date(start.getTime() + 36e5)
  await page.locator('#new-event-title').fill(`Event ${tag}`)
  await page.locator('#new-event-start').fill(localInput(start))
  // Moving the start fills the end one hour later.
  await expect(page.locator('#new-event-end')).toHaveValue(localInput(end))
  await page.locator('#new-event-end').fill(localInput(new Date(start.getTime() - 36e5)))
  await page.locator('#new-event-list').selectOption({ label: `List ${tag}` })
  await page.getByRole('button', { name: 'Create event' }).click()
  await expect(dialog(page).getByRole('alert')).toContainText('The end must be after the start')

  await page.locator('#new-event-end').fill(localInput(end))
  await page.locator('#new-event-priority').selectOption('high')
  await expect(page.locator('#new-event-reminder')).toContainText('3 days')
  await page.getByRole('button', { name: 'Create event' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.locator('.agenda-title', { hasText: `Event ${tag}` })).toBeVisible()
  await expect.poll(() => upcomingCount(page)).toBe(before + 1)

  const created = (await getEvents(request)).find((e) => e.title === `Event ${tag}`)!
  expect(new Date(created.start_date).getTime()).toBe(start.getTime())

  // High priority in 2 days -> a reminder that stays until dismissed; only then is it marked sent.
  const toast = page.locator('.toast', { hasText: `Event ${tag}` })
  await expect(toast).toBeVisible()
  expect((await getEvents(request)).find((e) => e.title === `Event ${tag}`)!.notified).toBe(false)
  await toast.getByRole('button', { name: 'Dismiss' }).click()
  await expect(toast).toHaveCount(0)
  await expect
    .poll(async () => (await getEvents(request)).find((e) => e.title === `Event ${tag}`)!.notified)
    .toBe(true)
})

test('clicking a calendar day opens New event prefilled at 09:00', async ({ page }) => {
  await page.goto('/')
  const day = page.locator('.fc-daygrid-day:not(.fc-day-other)').nth(10)
  const date = await day.getAttribute('data-date')
  await day.click({ position: { x: 10, y: 60 } })
  await expect(page.locator('#new-event-start')).toHaveValue(`${date}T09:00`)
  await expect(page.locator('#new-event-end')).toHaveValue(`${date}T10:00`)
})

test('modals: Escape and Close dismiss, focus returns to the trigger', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'New event', exact: true })
  await trigger.click()
  await expect(dialog(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await page.keyboard.press('c')
  await dialog(page).getByRole('button', { name: 'Close' }).click()
  await expect(dialog(page)).toHaveCount(0)
})

test('keyboard shortcuts: help, priority filter, filters focus', async ({ page, request }) => {
  await seed(request, { priority: 'high' })
  await page.goto('/')
  await page.keyboard.press('?')
  await expect(dialog(page).getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.keyboard.press('1')
  await expect(page.getByRole('button', { name: /^High/ })).toHaveAttribute('aria-pressed', 'true')
  for (const badge of await page.locator('.agenda-item .badge').all()) await expect(badge).toHaveText('High')
  await page.keyboard.press('0')
  await expect(page.locator('.chip').first()).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('/')
  await expect(page.locator('#dashboard-category-filter')).toBeFocused()
  // Shortcuts never fire while typing in a field.
  await page.keyboard.press('n')
  await expect(dialog(page)).toHaveCount(0)
})

test('category and list filters narrow the agenda and stay consistent', async ({ page, request }) => {
  const { category, list } = await seed(request)
  await page.goto('/')
  const all = await upcomingCount(page)

  await page.locator('#dashboard-category-filter').selectOption({ label: category.title })
  await expect.poll(() => upcomingCount(page)).toBe(1)

  await page.locator('#dashboard-category-filter').selectOption('')
  await page.locator('#dashboard-eventlist-filter').selectOption({ label: list.title })
  // Picking a list selects its category.
  await expect(page.locator('#dashboard-category-filter')).toHaveValue(String(category.id))
  await expect.poll(() => upcomingCount(page)).toBe(1)

  await page.locator('#dashboard-category-filter').selectOption('')
  await page.locator('#dashboard-eventlist-filter').selectOption('')
  await expect.poll(() => upcomingCount(page)).toBe(all)

  // A list in "Categories" filters too.
  await page.locator('.organize-list-btn', { hasText: list.title }).click()
  await expect(page.locator('#dashboard-eventlist-filter')).toHaveValue(String(list.id))
})

test('event detail: deep link, breadcrumb, edit with shortcuts, delete', async ({ page, request }) => {
  const { category, list, event } = await seed(request)
  await page.goto(`/#/events/${event.id}`)
  await expect(page.locator('.detail h1')).toHaveText(event.title)
  await expect(page.locator('.breadcrumb')).toContainText(category.title)
  await expect(page.locator('.breadcrumb')).toContainText(list.title)

  const stored = await (await request.get(`${API}/event/events/${event.id}`)).json()
  await page.keyboard.press('e')
  await expect(page.locator('#edit-start')).toHaveValue(localInput(new Date(stored.start_date)))

  await page.locator('#edit-title').fill('should not stick')
  await page.locator('#edit-title').press('Escape')
  await expect(page.locator('.detail h1')).toHaveText(event.title)

  await page.getByRole('button', { name: 'Edit' }).click()
  const newEnd = new Date(new Date(stored.end_date).getTime() + 2 * 36e5)
  await page.locator('#edit-title').fill(`${event.title} edited`)
  await page.locator('#edit-end').fill(localInput(newEnd))
  await page.locator('#edit-title').press('Control+Enter')
  await expect(page.locator('.detail h1')).toHaveText(`${event.title} edited`)
  const saved = await (await request.get(`${API}/event/events/${event.id}`)).json()
  expect(new Date(saved.end_date).getTime()).toBe(newEnd.getTime())

  await page.keyboard.press('d')
  await expect(page.locator('.confirm-text')).toContainText(`“${event.title} edited”`)
  await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeFocused()
  await dialog(page).getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/#\/$/)
  expect((await request.get(`${API}/event/events/${event.id}`)).status()).toBe(404)
})

test('event detail: J/K step through events, Esc goes back', async ({ page, request }) => {
  const a = await seed(request, { daysAhead: 30 })
  const b = await seed(request, { daysAhead: 31 })
  await page.goto(`/#/events/${a.event.id}`)
  await expect(page.locator('.detail h1')).toHaveText(a.event.title)
  await page.keyboard.press('j')
  await expect(page.locator('.detail h1')).toHaveText(b.event.title)
  await page.keyboard.press('k')
  await expect(page.locator('.detail h1')).toHaveText(a.event.title)
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/#\/$/)
})

test('unknown event id shows an error and the back button returns to the agenda', async ({ page }) => {
  await page.goto('/#/events/999999')
  await expect(page.getByRole('alert')).toContainText('No Event matches')
  await page.getByRole('button', { name: 'Agenda' }).click()
  await expect(page).toHaveURL(/#\/$/)
})

test('calendar event opens its detail page', async ({ page, request }) => {
  const { event } = await seed(request, { daysAhead: 0 })
  await page.goto('/')
  await page.locator('.fc-daygrid-event', { hasText: event.title }).click()
  await expect(page).toHaveURL(new RegExp(`#/events/${event.id}$`))
})

test('delete event list and category through a contextual confirmation', async ({ page, request }) => {
  const { category, list } = await seed(request)
  await page.goto('/')
  await page.getByRole('button', { name: `Delete list: ${list.title}` }).click()
  await expect(dialog(page)).toContainText('1 event')
  await dialog(page).getByRole('button', { name: 'Delete' }).click()
  await expect(page.locator('.organize-list-btn', { hasText: list.title })).toHaveCount(0)

  await page.getByRole('button', { name: `Delete category: ${category.title}` }).click()
  await expect(dialog(page)).toContainText('0 lists')
  await dialog(page).getByRole('button', { name: 'Delete' }).click()
  await expect(page.locator('.organize-category h3', { hasText: category.title })).toHaveCount(0)
})

test('language switch toggles Arabic RTL and is remembered', async ({ page }) => {
  await page.goto('/')
  await openMore(page)
  await page.getByRole('menuitem', { name: 'العربية' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('.fc-toolbar-title')).toHaveText(/[؀-ۿ]/)
  expect(await page.evaluate(() => localStorage.getItem('locale'))).toBe('ar')

  await page.getByRole('button', { name: 'المزيد' }).click()
  await page.getByRole('menuitem', { name: 'English' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
})

test('export then re-import the database, with confirmation', async ({ page }, testInfo) => {
  await page.goto('/')
  const before = await upcomingCount(page)

  await openMore(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Export data' }).click(),
  ])
  const file = testInfo.outputPath('export.json')
  await download.saveAs(file)
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).format).toBe('agendaops')
  await expect(page.locator('.toast', { hasText: 'Data exported' })).toBeVisible()

  await page.locator('input[type=file]').setInputFiles(file)
  await expect(dialog(page)).toContainText('Export first if you want to keep them')
  await dialog(page).getByRole('button', { name: 'Replace data' }).click()
  await expect(page.locator('.toast', { hasText: 'Data imported' })).toBeVisible()
  await expect.poll(() => upcomingCount(page)).toBe(before)

  const bad = testInfo.outputPath('bad.json')
  fs.writeFileSync(bad, 'not a database')
  await page.locator('input[type=file]').setInputFiles(bad)
  await dialog(page).getByRole('button', { name: 'Replace data' }).click()
  await expect(page.locator('.toast', { hasText: 'not a valid AgendaOPS backup' })).toBeVisible()
})

test('phone layout: no horizontal scroll, list calendar, thumb-reach new event button', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  await expect(page.locator('.agenda')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await expect(page.locator('.fc-list, .fc-list-empty').first()).toBeVisible()
  await page.locator('.fab').click()
  await expect(page.locator('#new-event-title')).toBeFocused()
})
