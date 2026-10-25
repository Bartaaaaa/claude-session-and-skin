import type { Activity, Sample, Usage, WeekTrack } from '../types'

export type { Activity }

// No combining accents, wide characters or right-to-left text in faces:
// terminals get their width wrong.

/** One face frame: eyes, mouth, what sticks out left or right, and the right eye if it differs. */
type Frame = { e: string; m: string; pre?: string; post?: string; r?: string }

const f = (e: string, m: string, pre = '', post = '', r?: string): Frame => ({ e, m, pre, post, r })

type Mood = {
  frames: Frame[]
  label: string
  base: string
  bright: string
  every: number // ticks per frame: smaller = more nervous
  from: number // % from which the mood is shown
}

export const MOODS: Mood[] = [
  { frames: [f('-', '‿'), f('-', '‿'), f('-', '‿'), f('•', '‿')], label: 'zen', base: '#3fb950', bright: '#9cf0ae', every: 8, from: 0 },
  { frames: [f('•', '‿'), f('•', '‿'), f('•', '‿'), f('-', '‿'), f('•', '‿'), f('•', '‿'), f('^', '‿'), f('•', '‿')], label: 'all good', base: '#d97757', bright: '#f5b49a', every: 4, from: 20 },
  { frames: [f('•', '_'), f('•', '_', '', ' .'), f('•', '_', '', ' ..'), f('•', '_', '', ' ...'), f('-', '_', '', ' ...'), f('•', '~'), f('•', '_'), f('•', '_', '', '', '-')], label: 'hmm…', base: '#d29922', bright: '#f8d878', every: 3, from: 60 },
  { frames: [f('°', '□', '', ';'), f('°', '□', '', ';'), f('°', 'o', '', ';'), f('°', '□', '', ';')], label: 'heating up', base: '#f0883e', bright: '#ffc08a', every: 2, from: 80 },
  { frames: [f('°', '□', '╯', '╯'), f('°', 'Д', '╯', '╯')], label: 'PANIC', base: '#f85149', bright: '#ffaaa5', every: 1, from: 90 },
  // Lifts the table, flips it and throws it; the arm stays inside the face so the face does not move
  {
    frames: [
      ...['┬─┬', '┬─┬', '┬─┬'].map(t => f('╯°', '□', '', `╯ ${t}`, '°')),
      ...['┻━┻', ' ┻━┻', '  ┻━┻', '   ┻━', '    ┻', '', ''].map(t => f('╯°', 'Д', '', `╯ ${t}`, '°')),
    ],
    label: 'TABLE FLIP', base: '#b62324', bright: '#ff7b72', every: 2, from: 95,
  },
  // Out of tokens: K.O., crossed-out eyes, stars spinning around the head
  {
    frames: ['  *', ' * ', '*  ', ' * '].map(stars => f('×', '_', '', ` ${stars}`)),
    label: 'K.O.', base: '#8b949e', bright: '#c9d1d9', every: 3, from: 100,
  },
]

export const SLEEP_FRAME = f('-', '.')
export const SLEEP_Z = ['z', 'zZ', 'zzZ', '']
export const ERROR_FRAME = f('×', '_')
/** The 5h window just reset: arms up. */
export const REFRESH_FRAMES = [f('^', '‿', '\\', '/ ✧'), f('^', '‿', '\\', '/ ✦'), f('^', '▽', '\\', '/ ✧'), f('^', '▽', '\\', '/ ✦')]

const SNIPPETS = ['</>', '{;}', '=>;']

/** The frames of each activity, and their speed (ticks per frame). */
export const ACTIVITIES: Record<Activity, { label: string; frames: Frame[]; every: number }> = {
  // A thought bubble grows three times, then the idea comes
  think: {
    label: 'is thinking',
    frames: [
      ...[1, 2, 3].flatMap(() => [f('•', '_'), f('•', '_', '', ' .'), f('•', '_', '', ' .o'), f('•', '_', '', ' .oO'), f('-', '_', '', ' .oO')]),
      f('°', 'o', '', ' !'), f('°', 'o', '', ' !'), f('°', 'o', '', ' !'),
    ],
    every: 4,
  },
  // Eyes on the keyboard, types a snippet, then looks up to admire it
  code: {
    label: 'is coding',
    frames: SNIPPETS.flatMap(code => [
      f('.', '_'),
      ...Array.from(code, (_, i) => f('.', '_', '', code.slice(0, i + 1))),
      f('•', '‿', '', code),
      f('•', '‿', '', code),
    ]),
    every: 2,
  },
  // Reads a page, blinking now and then
  read: { label: 'is reading', frames: [f('•', '_', '', '≡'), f('•', '_', '', '≡'), f('•', '_', '', '≡'), f('-', '_', '', '≡')], every: 3 },
  // A shell prompt with a blinking cursor
  shell: { label: 'runs a command', frames: [f('.', '_', '', '$_'), f('.', '_', '', '$ ')], every: 3 },
  // Searching, searching… found it!
  web: { label: 'searches the web', frames: [f('o', '_', '', '?'), f('O', '_', '', '?'), f('o', '_', '', '?'), f('O', 'o', '', '!')], every: 4 },
  // Sends agents off to work
  agent: { label: 'delegates to an agent', frames: [f('•', '_', '', '›'), f('•', '_', '', '››'), f('•', '‿', '', '›››')], every: 3 },
  // Its agents run in the background: watching the hourglass
  wait: { label: 'waits for its agents', frames: [f('•', '_', '', '⧗'), f('•', '_', '', '⧗'), f('-', '_', '', '⧗'), f('•', '_', '', '⧖')], every: 5 },
}

const TOOL_ACTIVITY: Record<string, Activity> = {
  Edit: 'code', MultiEdit: 'code', Write: 'code', NotebookEdit: 'code',
  Read: 'read', Grep: 'read', Glob: 'read', LS: 'read',
  Bash: 'shell', PowerShell: 'shell',
  WebFetch: 'web', WebSearch: 'web',
  Agent: 'agent', Task: 'agent',
}

export const activityFor = (tool: string): Activity => TOOL_ACTIVITY[tool] ?? 'think'

/** A one-line character: how it draws eyes and a mouth. */
type Face = { face: (l: string, m: string, r: string) => string; mouths?: Record<string, string> }
/** A character: a one-line face, or `tall`, a 3-line drawing with its own animations (tall.ts). */
export type Skin = { label: string } & (Face | { tall: Tall } | { isHidden: true })
/** The characters drawn on 3 lines. */
export type Tall = 'clawd' | 'whale' | 'cat' | 'crewmate' | 'dino' | 'bb8'

export const SKINS: Record<string, Skin> = {
  smiley: { label: 'Smiley', face: (l, m, r) => `(${l}${m}${r})` },
  // The Claude Code mascot, drawn on 3 lines as on the startup screen
  clawd: { label: 'Clawd', tall: 'clawd' },
  whale: { label: 'Whale', tall: 'whale' },
  cat: { label: 'Cat', tall: 'cat' },
  crewmate: { label: 'Crewmate', tall: 'crewmate' },
  dino: { label: 'Dino', tall: 'dino' },
  bb8: { label: 'BB-8', tall: 'bb8' },
  // Just the bar, no character
  none: { label: 'None', isHidden: true },
}
export const DEFAULT_SKIN = 'clawd'

export const skinOf = (name: unknown): Skin => SKINS[typeof name === 'string' ? name : ''] ?? SKINS[DEFAULT_SKIN]!

export const drawFace = (skin: Face, fr: Frame) =>
  (fr.pre ?? '') + skin.face(fr.e, skin.mouths?.[fr.m] ?? fr.m, fr.r ?? fr.e) + (fr.post ?? '')

export const tierFor = (percent: number) => Math.max(0, MOODS.findLastIndex(m => percent >= m.from))

const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const toHex = (rgb: number[]) => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')

const mix = (a: string, b: string, t: number) => {
  const x = hex(a)
  const y = hex(b)
  return toHex(x.map((v, i) => v + (y[i]! - v) * t))
}

/** Colour pulsing between base and bright over `period` ticks. */
export const pulse = (mood: Mood, tick: number, period: number) =>
  mix(mood.base, mood.bright, (1 - Math.cos((2 * Math.PI * tick) / period)) / 2)

const GRADIENT = ['#3fb950', '#d29922', '#f0883e', '#f85149']

/** Colour of cell `i` out of `n`: green → yellow → orange → red. */
export const gradientAt = (i: number, n: number) => gradientOf(i / Math.max(1, n - 1))

/** Colour at position `t` (0 to 1) of the green → red gradient. */
const gradientOf = (t: number) => {
  const pos = Math.min(1, Math.max(0, t)) * (GRADIENT.length - 1)
  const k = Math.min(GRADIENT.length - 2, Math.floor(pos))
  return mix(GRADIENT[k]!, GRADIENT[k + 1]!, pos - k)
}

export const filledCells = (percent: number, n: number) => Math.min(n, Math.round((percent / 100) * n))

export const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const dayHhmm = (ms: number) => `${DAYS[new Date(ms).getDay()]} ${hhmm(ms)}`

const MIN_SPAN_MS = 5 * 60_000

/** Adds a reading; starts over when the window has been reset. */
export const addSample = (samples: Sample[], s: Sample): Sample[] => {
  const last = samples[samples.length - 1]
  const isNewWindow = last !== undefined && (last.resetsAt !== s.resetsAt || s.p < last.p)
  return [...(isNewWindow ? [] : samples), s].slice(-60)
}

/** Estimated time of reaching 100 % at the current rate, or null if unknown. */
export const projectFull = (samples: Sample[]): number | null => {
  const last = samples[samples.length - 1]
  const perHour = ratePerHour(samples)
  if (!last || !perHour) return null
  return last.t + ((100 - last.p) / perHour) * 3600_000
}

/** Usage rate of the 5h window in % per hour, or null before 5 min of readings. */
export const ratePerHour = (samples: Sample[]): number | null => {
  const first = samples[0]
  const last = samples[samples.length - 1]
  if (!first || !last || last.t - first.t < MIN_SPAN_MS) return null
  return (Math.max(0, last.p - first.p) / (last.t - first.t)) * 3600_000
}

export const rateLabel = (perHour: number) => `+${perHour < 10 ? Math.round(perHour * 10) / 10 : Math.round(perHour)}%/h`

/** A short duration: "12m", "1h05". */
export const durationLabel = (ms: number) => {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours}h${String(minutes % 60).padStart(2, '0')}` : `${minutes}m`
}

/** On-screen width: combining accents 0, CJK characters 2, everything else 1. */
export const cellWidth = (text: string) => {
  let w = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c >= 0x300 && c <= 0x36f) continue
    w += (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xff60) ? 2 : 1
  }
  return w
}

/** Pads with spaces up to `width` columns, so the bar does not move. */
export const padCells = (text: string, width: number) => text + ' '.repeat(Math.max(0, width - cellWidth(text)))

const DAY_MS = 24 * 3600_000
const WEEK_DAYS = 7
/** Daily budget: the week spread over 5 working days. */
const DAY_BUDGET = 20

/** Day of the 7-day window (0 to 6) that contains `t`. */
export const weekDay = (t: number, resetsAt: number) =>
  Math.min(WEEK_DAYS - 1, Math.max(0, Math.floor((t - (resetsAt - WEEK_DAYS * DAY_MS)) / DAY_MS)))

/** Reset time of a window, rounded to the minute: the same window keeps the same key. */
export const resetOf = (iso: string | null) => {
  const ms = iso ? Date.parse(iso) : NaN
  return Number.isNaN(ms) ? null : Math.round(ms / 60_000) * 60_000
}

/** True when the 5h window changed and usage dropped: the session just reset. */
export const isFreshWindow = (before: Usage | null, now: Usage) => {
  const resetBefore = resetOf(before?.resetsAt ?? null)
  const resetNow = resetOf(now.resetsAt)
  return resetBefore !== null && resetNow !== null && resetBefore !== resetNow
    && before?.session != null && now.session !== null && now.session < before.session
}

/** The track if it belongs to week `resetsAt`, otherwise null: a past week is never shown. */
export const trackOf = (value: unknown, resetsAt: number | null): WeekTrack | null =>
  value && typeof value === 'object' && 'max' in value && (value as WeekTrack).resetsAt === resetsAt
    ? (value as WeekTrack)
    : null

/** False for a finished or unreadable week track: it no longer belongs in the store. */
export const isWeekRunning = (value: unknown, now: number) =>
  !!value && typeof value === 'object' && 'resetsAt' in value && Number(value.resetsAt) > now

/** Adds a weekly % reading; starts over when the week has been reset. */
export const recordWeek = (track: WeekTrack | null, t: number, resetsAt: number, p: number): WeekTrack => {
  const day = weekDay(t, resetsAt)
  const base: WeekTrack = track && track.resetsAt === resetsAt
    ? track
    : { resetsAt, start: { day, p }, max: {} }
  return { ...base, max: { ...base.max, [day]: Math.max(p, base.max[day] ?? 0) } }
}

/** Usage of each day of the window, in % points; null for an unknown or future day. */
export const dailyUsage = (track: WeekTrack | null, today: number): (number | null)[] => {
  let prev = track?.start.p ?? 0
  return Array.from({ length: WEEK_DAYS }, (_, day) => {
    if (!track || day < track.start.day || day > today) return null
    const reached = Math.max(prev, track.max[day] ?? prev)
    const used = reached - prev
    prev = reached
    return Math.round(used * 10) / 10
  })
}

/** Green well under the daily budget, red at 1.5 times the budget and above. */
export const dayColor = (used: number) => gradientOf(used / (DAY_BUDGET * 1.5))
