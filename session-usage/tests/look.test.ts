import { test, expect } from 'claude-code/testing'
import {
  tierFor, gradientAt, filledCells, addSample, projectFull, ratePerHour, rateLabel, percentLabel, durationLabel,
  activityFor,
  weekDay, resetOf, isFreshWindow, trackOf, isWeekRunning, recordWeek, dailyUsage, dayColor,
} from '../hooks/look'

test('tiers 0-20, 20-60, 60-80, 80-90, 90-95, 95-100, K.O. at 100', async () => {
  expect(tierFor(0)).toBe(0)
  expect(tierFor(19.9)).toBe(0)
  expect(tierFor(20)).toBe(1)
  expect(tierFor(59.9)).toBe(1)
  expect(tierFor(60)).toBe(2)
  expect(tierFor(79.9)).toBe(2)
  expect(tierFor(80)).toBe(3)
  expect(tierFor(89.9)).toBe(3)
  expect(tierFor(90)).toBe(4)
  expect(tierFor(94.9)).toBe(4)
  expect(tierFor(95)).toBe(5)
  expect(tierFor(99.9)).toBe(5)
  expect(tierFor(100)).toBe(6)
  expect(tierFor(130)).toBe(6)
})

test('green → red gradient', async () => {
  expect(gradientAt(0, 10)).toBe('#3fb950')
  expect(gradientAt(9, 10)).toBe('#f85149')
  expect(filledCells(68, 10)).toBe(7)
})

test('projection to 100 %', async () => {
  const min = 60_000
  let s = addSample([], { t: 0, p: 10, resetsAt: 'R' })
  expect(projectFull(s)).toBe(null)
  s = addSample(s, { t: 10 * min, p: 20, resetsAt: 'R' })
  // 1 % per minute: 80 % left → 80 more minutes
  expect(projectFull(s)).toBe(90 * min)
  // new window: start over
  s = addSample(s, { t: 11 * min, p: 1, resetsAt: 'R2' })
  expect(s.length).toBe(1)
})

test('a reset time that jitters by a few seconds keeps the readings', async () => {
  let s = addSample([], { t: 0, p: 10, resetsAt: '2026-10-25T18:00:00.000Z' })
  s = addSample(s, { t: 60_000, p: 11, resetsAt: '2026-10-25T18:00:02.000Z' })
  expect(s.length).toBe(2)
})

test('percentages keep at most one decimal', async () => {
  expect(percentLabel(33.3333)).toBe('33.3%')
  expect(percentLabel(100)).toBe('100%')
})

test('each tool has its animation', async () => {
  expect(activityFor('Edit')).toBe('code')
  expect(activityFor('Read')).toBe('read')
  expect(activityFor('Bash')).toBe('shell')
  expect(activityFor('WebSearch')).toBe('web')
  expect(activityFor('Agent')).toBe('agent')
  expect(activityFor('mcp__slack__send')).toBe('think')
})

test('weekly usage day by day', async () => {
  const day = 24 * 3600_000
  const reset = 7 * day
  expect(weekDay(0, reset)).toBe(0)
  expect(weekDay(6.5 * day, reset)).toBe(6)
  // first reading on day 1 at 10 %: the days before are unknown
  let w = recordWeek(null, 1 * day, reset, 10)
  w = recordWeek(w, 1.5 * day, reset, 14)
  w = recordWeek(w, 3.2 * day, reset, 40)
  expect(dailyUsage(w, 3)).toEqual([null, 4, 0, 26, null, null, null])
  // new week: start over
  w = recordWeek(w, 7.5 * day, 14 * day, 2)
  expect(dailyUsage(w, 0)).toEqual([0, null, null, null, null, null, null])
})

test('a past week is never reused', async () => {
  const reset = resetOf('2026-10-13T08:00:00.000Z')!
  expect(resetOf('2026-10-13T08:00:12.345Z')).toBe(reset)
  expect(resetOf(null)).toBe(null)
  const old = recordWeek(null, reset - 3 * 24 * 3600_000, reset, 30)
  expect(trackOf(old, reset)).toEqual(old)
  expect(trackOf(old, reset + 7 * 24 * 3600_000)).toBe(null)
  expect(trackOf('n\'importe quoi', reset)).toBe(null)
  expect(isWeekRunning(old, reset - 1)).toBe(true)
  expect(isWeekRunning(old, reset)).toBe(false)
  expect(isWeekRunning(undefined, 0)).toBe(false)
})

test('day colour against the 20 % budget', async () => {
  expect(dayColor(0)).toBe('#3fb950')
  expect(dayColor(30)).toBe('#f85149')
  expect(dayColor(80)).toBe('#f85149')
})

test('detects a 5h session reset', async () => {
  const u = (session: number | null, resetsAt: string | null) => ({ session, resetsAt, week: null, weekResetsAt: null, context: null })
  expect(isFreshWindow(u(97, '2026-10-08T15:00:00Z'), u(1, '2026-10-08T20:00:00Z'))).toBe(true)
  expect(isFreshWindow(u(97, '2026-10-08T15:00:00Z'), u(98, '2026-10-08T15:00:20Z'))).toBe(false)
  expect(isFreshWindow(null, u(1, '2026-10-08T20:00:00Z'))).toBe(false)
  expect(isFreshWindow(u(40, '2026-10-08T15:00:00Z'), u(45, '2026-10-08T20:00:00Z'))).toBe(false)
})

test('usage rate in % per hour, after 5 min of readings', async () => {
  const min = 60_000
  let s = addSample([], { t: 0, p: 10, resetsAt: 'R' })
  s = addSample(s, { t: 4 * min, p: 12, resetsAt: 'R' })
  expect(ratePerHour(s)).toBe(null)
  s = addSample(s, { t: 20 * min, p: 16, resetsAt: 'R' })
  expect(ratePerHour(s)).toBe(18)
  expect(rateLabel(18)).toBe('+18%/h')
  expect(rateLabel(4.56)).toBe('+4.6%/h')
  expect(rateLabel(0)).toBe('+0%/h')
})

test('short durations', async () => {
  expect(durationLabel(0)).toBe('0m')
  expect(durationLabel(12 * 60_000 + 59_000)).toBe('12m')
  expect(durationLabel(125 * 60_000)).toBe('2h05')
})
