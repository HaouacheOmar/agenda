import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api'

const fetchMock = vi.fn<typeof fetch>()

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  fetchMock.mockReset()
  vi.restoreAllMocks()
})

describe('api requests', () => {
  it('parses JSON responses', async () => {
    fetchMock.mockResolvedValue(json([{ id: 1, title: 'Work', date_created: '' }]))
    await expect(api.getCategories()).resolves.toEqual([{ id: 1, title: 'Work', date_created: '' }])
    expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:8000/category/categories/')
  })

  it('sends JSON bodies with a JSON content type', async () => {
    fetchMock.mockResolvedValue(json({ id: 2, title: 'Home', date_created: '' }, 201))
    await api.createCategory({ title: 'Home' })
    const init = fetchMock.mock.calls[0]![1]!
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"title":"Home"}')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('returns undefined on 204 No Content', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(api.deleteEvent(5)).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:8000/event/events/5')
  })

  it('lets the browser set the multipart boundary for uploads', async () => {
    fetchMock.mockResolvedValue(json({ msg: 'ok' }))
    await api.importData(new File(['{}'], 'backup.json'))
    const init = fetchMock.mock.calls[0]![1]!
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.headers).toBeUndefined()
  })
})

describe('api errors', () => {
  it('uses the Django {err} message', async () => {
    fetchMock.mockResolvedValue(json({ err: 'invalid priority: urgent' }, 400))
    await expect(api.getEvents()).rejects.toThrow('invalid priority: urgent')
  })

  it('uses the DRF {detail} message', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'No Event matches the given query.' }, 404))
    await expect(api.getEventById(9)).rejects.toThrow('No Event matches the given query.')
  })

  it('flattens DRF field validation errors', async () => {
    fetchMock.mockResolvedValue(json({ end_date: ['End date must be after start.'], title: ['Required.'] }, 400))
    await expect(api.getEvents()).rejects.toThrow('end_date: End date must be after start.\ntitle: Required.')
  })

  it('reads plain-text / HTML error bodies instead of crashing on JSON parsing', async () => {
    fetchMock.mockResolvedValue(new Response('<h1>Server Error</h1>', { status: 500, headers: { 'Content-Type': 'text/html' } }))
    await expect(api.getEvents()).rejects.toThrow('<h1>Server Error</h1>')
  })

  it('falls back to the HTTP status for an empty error body', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 502 }))
    await expect(api.getEvents()).rejects.toThrow('HTTP 502')
  })
})
