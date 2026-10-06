import test from 'node:test'
import assert from 'node:assert'

globalThis.window = globalThis
globalThis.localStorage = { getItem: () => null, setItem() {} }
await import('../assets/core.js')
await import('../assets/ics.js')
const MT = globalThis.MT

const data = {
  id: 'demo', title: 'Demo',
  eras: [{ title: 'Era', items: [
    { id: 'f1', name: 'Film One', film: true, runtime: 100 },
    { id: 'show', name: 'The Show', seasons: [2, 3], epAvg: 25 },
    { id: 'f2', name: 'Film Two', film: true, runtime: 120 },
    { id: 'opt', name: 'Optional', tier: 'extra', film: true, runtime: 90 },
  ] }],
  tiers: [{ id: 'extra', label: 'Extra', default: false }],
}
const filters = MT.defaultFilters(data)

test('watchQueue: order, season/episode numbering, skips, done, hidden tiers', () => {
  const q = MT.watchQueue(data, new Set(['f1', 'show-s1e1']), new Set(['f2']), filters, 10)
  assert.deepStrictEqual(q.map((u) => u.title), ['The Show S1E2', 'The Show S2E1', 'The Show S2E2', 'The Show S2E3'])
  assert.deepStrictEqual(MT.watchQueue(data, new Set(), new Set(), filters, 3).map((u) => u.title), ['Film One', 'The Show S1E1', 'The Show S1E2'])
  assert.strictEqual(MT.watchQueue(data, new Set(), new Set(), { extra: true }, 50).at(-1).title, 'Optional')
  assert.strictEqual(MT.watchQueue(data, new Set(), new Set(), filters, 0).length, 0)
})
test('watchQueue: a finished series is skipped entirely', () => {
  const done = new Set(['show-s1e1', 'show-s1e2', 'show-s2e1', 'show-s2e2', 'show-s2e3'])
  assert.deepStrictEqual(MT.watchQueue(data, done, new Set(), filters, 5).map((u) => u.id), ['f1', 'f2'])
})
test('buildPlan: one unit per franchise per day, stacked from the start time, stable UIDs', () => {
  const ev = MT.buildPlan([{ data, done: new Set(), skip: new Set(), filters }], { start: new Date(2026, 9, 6), hour: 19, minute: 30, days: 3, perDay: 1 })
  assert.strictEqual(ev.length, 3)
  assert.deepStrictEqual(ev.map((e) => e.start.getDate()), [6, 7, 8])
  assert.ok(ev.every((e) => e.start.getHours() === 19 && e.start.getMinutes() === 30))
  assert.strictEqual(ev[0].uid, 'demo-f1')
  const two = MT.buildPlan([{ data, done: new Set(), skip: new Set(), filters }], { start: new Date(2026, 9, 6), days: 1, perDay: 2 })
  assert.strictEqual(two[1].start.getTime() - two[0].start.getTime(), (100 + 10) * 60000) // film (100m) + 10 min gap
})
test('buildIcs: CRLF, required fields, escaping, folding <= 75 octets, valid structure', () => {
  const long = 'A very long title, with; punctuation and unicode \u2014 \u{1F3AC} '.repeat(5)
  const ics = MT.buildIcs([{ uid: 'x-1', start: new Date(2026, 9, 6, 19, 0), minutes: 45, summary: long, description: 'line1\nline2', url: 'https://timelines.hackatoa.com/' }], { now: new Date(Date.UTC(2026, 9, 6, 12, 0, 0)) })
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'))
  assert.match(ics, /\r\nUID:x-1@timelines\.hackatoa\.com\r\n/)
  assert.match(ics, /\r\nDTSTART:20261006T190000\r\n/)
  assert.match(ics, /\r\nDTEND:20261006T194500\r\n/)
  assert.match(ics, /DTSTAMP:20261006T120000Z/)
  assert.match(ics, /DESCRIPTION:line1\\nline2/)
  const enc = new TextEncoder()
  for (const l of ics.split('\r\n')) assert.ok(enc.encode(l).length <= 75, 'line too long: ' + l.length)
  const unfolded = ics.replace(/\r\n /g, '')
  assert.ok(unfolded.includes('SUMMARY:A very long title\\, with\\; punctuation'))
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, (ics.match(/END:VEVENT/g) || []).length)
})
