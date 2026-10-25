import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { Usage, Sample } from '../types'
import type { Activity } from './look'
import { drawClawd } from './clawd'
import { drawWhale } from './whale'
import { drawCat } from './cat'
import { drawCrewmate } from './crewmate'
import { drawDino } from './dino'
import { drawBb8 } from './bb8'
import { TALL_MOODS, type Drawing, type TallState } from './tall'
import {
  type Tall,
  MOODS, ACTIVITIES, SKINS, DEFAULT_SKIN, SLEEP_FRAME, SLEEP_Z, ERROR_FRAME, REFRESH_FRAMES,
  activityFor, skinOf, drawFace, cellWidth, padCells,
  tierFor, pulse, gradientAt, filledCells, hhmm, dayHhmm, addSample, projectFull, ratePerHour, rateLabel, percentLabel, durationLabel,
  weekDay, resetOf, isFreshWindow, trackOf, isWeekRunning, recordWeek, dailyUsage, dayColor,
} from './look'

const usage = atom({ plugin: 'session-usage', key: 'usage' } as const, null)
const frame = atom({ plugin: 'session-usage', key: 'frame' } as const, 0)
const lastActive = atom({ plugin: 'session-usage', key: 'lastActive' } as const, 0)
const errorAt = atom({ plugin: 'session-usage', key: 'errorAt' } as const, null as number | null)
const refreshedAt = atom({ plugin: 'session-usage', key: 'refreshedAt' } as const, null as number | null)
const samples = atom({ plugin: 'session-usage', key: 'samples' } as const, [] as Sample[])
const demoStartedAt = atom({ plugin: 'session-usage', key: 'demoStartedAt' } as const, null as number | null)
const activity = atom({ plugin: 'session-usage', key: 'activity' } as const, null as Activity | null)
const inTurn = atom({ plugin: 'session-usage', key: 'inTurn' } as const, false)
const startedAt = atom({ plugin: 'session-usage', key: 'startedAt' } as const, null as number | null)

/** Store key of the chosen character, kept across sessions. */
const SKIN_KEY = 'skin'
/** Store key of the day-by-day readings of the current week. */
const WEEK_KEY = 'week'

const TICK_MS = 150
const BAR_CELLS = 10
// One glyph for filled and empty cells: only the colour changes, so every cell has the same size
const CELL = '▰'
/** Each 3-line character: its drawing and its colour. */
const TALL: Record<Tall, { draw: (state: TallState, tick: number) => Drawing; color: string }> = {
  clawd: { draw: drawClawd, color: '#d97757' },
  whale: { draw: drawWhale, color: '#4a9fe0' },
  cat: { draw: drawCat, color: '#f39c3c' },
  crewmate: { draw: drawCrewmate, color: '#e5534b' },
  dino: { draw: drawDino, color: '#a8a8a8' },
  bb8: { draw: drawBb8, color: '#ff9f43' },
}
// "100%", "91.5%": the width stays the same when the % changes
const PERCENT_WIDTH = 5
const SLEEP_AFTER_MS = 25 * 60_000
const ERROR_SHOW_MS = 2500
const REFRESH_SHOW_MS = 10_000

// /usage-demo: each state is shown for DEMO_STEP_MS, then the real bar comes back
type DemoStep = { label: string; percent: number; activity?: Activity; isSleeping?: boolean; isHurt?: boolean; isRefreshed?: boolean }
const DEMO_STEP_MS = 3000
const DEMO: DemoStep[] = [
  ...MOODS.map((m, i) => {
    const to = MOODS[i + 1]?.from ?? 100
    return { label: m.from === to ? `${m.label} (${m.from} %)` : `${m.label} (${m.from}–${to} %)`, percent: Math.round((m.from + to) / 2) }
  }),
  ...(Object.keys(ACTIVITIES) as Activity[]).map(a => ({ label: `Claude ${ACTIVITIES[a].label}`, percent: 30, activity: a })),
  { label: 'a tool failed', percent: 30, isHurt: true },
  { label: 'asleep (25 min idle)', percent: 30, isSleeping: true },
  { label: 'the 5h session resets', percent: 1, isRefreshed: true },
]

// Daily usage shown by /usage-demo
const DEMO_DAYS = [4, 12, 22, 35, 9, null, null]

// The store only keeps the current week: a new week overwrites the old one
const trackWeek = async ($: EngineInterface, u: Usage) => {
  const resetsAt = resetOf(u.weekResetsAt)
  if (u.week === null || resetsAt === null) return
  const now = await $.clock.now()
  const track = trackOf(await $.store.get(WEEK_KEY), resetsAt)
  await $.store.set(WEEK_KEY, recordWeek(track, now, resetsAt, u.week))
}

// A finished week with no new reading does not stay in the store
const dropEndedWeek = async ($: EngineInterface) => {
  if (!isWeekRunning(await $.store.get(WEEK_KEY), await $.clock.now())) await $.store.delete(WEEK_KEY)
}

const ACTIVE_AGENT = ['pending', 'running', 'waiting']

const backgroundAgents = async ($: EngineInterface) => {
  try {
    const agents = await $.agent.list()
    return agents.filter(a => a.parentId === undefined && ACTIVE_AGENT.includes(a.status)).length
  } catch {
    return 0
  }
}

const toUsage = (rateLimits: SessionRateLimit[]): Usage => {
  const fiveHour = rateLimits.find(r => r.kind === 'five_hour')
  const sevenDay = rateLimits.find(r => r.kind === 'seven_day')
  return {
    session: fiveHour?.percentUsed ?? null,
    resetsAt: fiveHour?.resetsAt ?? null,
    week: sevenDay?.percentUsed ?? null,
    weekResetsAt: sevenDay?.resetsAt ?? null,
  }
}

export const register: Register = (on, options) => {
  const isShown = (option: string) => options[option] !== false

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'usage-demo', description: 'Plays every animation of the usage bar' })
    await $.command.register({ name: 'usage-skin', description: `Changes character: ${Object.keys(SKINS).join(', ')}` })
    const u = await $.session.usage()
    const first = toUsage(u.rateLimits)
    await update($, usage, () => first)
    await update($, startedAt, () => u.startedAt)
    await dropEndedWeek($)
    await trackWeek($, first)
    const now = await $.clock.now()
    await update($, lastActive, () => now)
    $.clock.every(TICK_MS, () => {
      void update($, frame, f => (f + 1) % 1_000_000)
    })
    return result
  })

  on('session.measure', async ($, e, next) => {
    const u = toUsage(e.rateLimits)
    if (isFreshWindow(await read($, usage), u)) {
      const now = await $.clock.now()
      await update($, refreshedAt, () => now)
    }
    await update($, usage, () => u)
    await trackWeek($, u)

    if (u.session !== null) {
      const percent = u.session
      const now = await $.clock.now()
      await update($, samples, s => addSample(s, { t: now, p: percent, resetsAt: u.resetsAt }))
    }

    return next(e)
  })

  on('command.run', { command: 'usage-demo' }, async $ => {
    const now = await $.clock.now()
    await update($, demoStartedAt, () => now)
    return { text: `Animation demo: ${DEMO.length} states, ${Math.round((DEMO.length * DEMO_STEP_MS) / 1000)} s.` }
  })

  on('command.run', { command: 'usage-skin' }, async ($, e) => {
    const wanted = e.args.trim().toLowerCase().replaceAll('-', '')
    const stored = await $.store.get(SKIN_KEY)
    const current = typeof stored === 'string' && stored in SKINS ? stored : DEFAULT_SKIN
    const preview = (name: string) => {
      const skin = SKINS[name]!
      if ('isHidden' in skin) return '(bar only)'
      return 'tall' in skin ? TALL[skin.tall].draw('zen', 0).rows.map(row => `\n    ${row}`).join('') : drawFace(skin, MOODS[1]!.frames[0]!)
    }

    if (!wanted) {
      const list = Object.keys(SKINS)
        .map(name => `${name === current ? '›' : ' '} ${name.padEnd(7)} ${preview(name)}`)
        .join('\n')
      return { text: `Characters (/usage-skin <name>):\n${list}` }
    }
    if (!(wanted in SKINS)) {
      return { text: `Unknown character: "${wanted}". Choose from: ${Object.keys(SKINS).join(', ')}.` }
    }
    await $.store.set(SKIN_KEY, wanted)
    if ('isHidden' in SKINS[wanted]!) return { text: 'No character: just the usage bar.' }
    return { text: `${SKINS[wanted]!.label} is here! ${preview(wanted)}` }
  })

  // Any activity wakes the character up
  on('prompt.submit', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, lastActive, () => now)
    return next(e)
  }).catch(($, e, next) => next(e)) // observer: never blocks a prompt

  // During a turn the character never falls asleep, even while waiting for a permission
  on('turn.start', async ($, e, next) => {
    await update($, inTurn, () => true)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, lastActive, () => now)
    await update($, activity, () => null)
    await update($, inTurn, () => false)
    return next(e)
  })

  // The running tool picks the animation; a tool error dazes the character
  let toolsRunning = 0
  on('tool.call', async ($, e, next) => {
    toolsRunning++
    await update($, activity, () => activityFor(e.tool))
    try {
      const r = await next(e)
      if ('isError' in r && r.isError) {
        const now = await $.clock.now()
        await update($, errorAt, () => now)
      }
      return r
    } finally {
      toolsRunning--
      if (toolsRunning === 0) {
        await update($, activity, () => null)
      }
    }
  }).catch(($, e, next) => next(e)) // observer: never blocks a tool

  // Claude Code's "Clauding…" line is hidden: the character already shows that Claude is working
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if ('isHidden' in skinOf(await $.store.get(SKIN_KEY))) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }
    let u = await read($, usage)
    if (u === null) {
      const fresh = await $.session.usage()
      u = toUsage(fresh.rateLimits)
    }

    const { Box, Text } = $.ui.resolve(e)
    const skin = skinOf(await $.store.get(SKIN_KEY))
    const tick = await read($, frame)
    const now = await $.clock.now()
    let percent = u.session ?? 0
    let week = u.week
    const weekResetMs = resetOf(u.weekResetsAt)
    const today = weekResetMs === null ? 0 : weekDay(now, weekResetMs)
    let days = dailyUsage(trackOf(await $.store.get(WEEK_KEY), weekResetMs), today)

    // Projection: when 100 % will be reached, flagged on hover if it comes before the reset
    const readings = await read($, samples)
    const fullAt = projectFull(readings)
    const resetMs = resetOf(u.resetsAt)
    const isWorried = fullAt !== null && resetMs !== null && fullAt < resetMs

    let doing: Activity | null = e.props.isWorking
      ? ((await read($, activity)) ?? 'think')
      : (await backgroundAgents($)) > 0 ? 'wait' : null
    let isSleeping = doing === null && !(await read($, inTurn)) && now - (await read($, lastActive)) > SLEEP_AFTER_MS
    const lastError = await read($, errorAt)
    let isHurt = lastError !== null && now - lastError < ERROR_SHOW_MS
    const lastRefresh = await read($, refreshedAt)
    let isRefreshed = lastRefresh !== null && now - lastRefresh < REFRESH_SHOW_MS

    // During /usage-demo, the current step replaces the real values
    const demoAt = await read($, demoStartedAt)
    const demoIndex = demoAt === null ? -1 : Math.floor((now - demoAt) / DEMO_STEP_MS)
    const demo = DEMO[demoIndex]
    if (demo) {
      percent = demo.percent
      week = Math.round(demo.percent * 0.6)
      days = DEMO_DAYS
      doing = demo.activity ?? null
      isSleeping = demo.isSleeping ?? false
      isHurt = demo.isHurt ?? false
      isRefreshed = demo.isRefreshed ?? false
    }

    const mood = MOODS[tierFor(percent)]!
    const color = pulse(mood, tick, isSleeping ? 40 : mood.every * 8)
    const isKo = percent >= 100
    const anim = isHurt
      ? { frames: [ERROR_FRAME], every: 1 }
      : isRefreshed
        ? { frames: REFRESH_FRAMES, every: 3 }
        : isKo
          ? mood
          : isSleeping
            // The "zzz" stick to the face, inside its column: the bar does not move
            ? { frames: SLEEP_Z.map(z => ({ ...SLEEP_FRAME, post: z })), every: 7 }
            : doing
              ? ACTIVITIES[doing]
              : mood

    const bar = (key: string, value: number, n: number) => {
      const filled = filledCells(value, n)
      return Array.from({ length: n }, (_, i) =>
        i < filled
          ? <Text key={`${key}${i}`} color={gradientAt(i, n)}>{CELL}</Text>
          : <Text key={`${key}${i}`} dimColor>{CELL}</Text>,
      )
    }
    const shown = demo ? percent : u.session

    const details = [
      resetMs !== null ? `↻ ${hhmm(resetMs)}` : null,
      fullAt !== null ? `100% at ${hhmm(fullAt)}${isWorried ? ' ⚠' : ''}` : null,
      u.week !== null ? `7d ${percentLabel(u.week)}${weekResetMs !== null ? ` ↻ ${dayHhmm(weekResetMs)}` : ''}` : null,
    ].filter(Boolean).join(' · ')

    const perHour = ratePerHour(readings)
    const began = (await read($, startedAt)) ?? (await $.session.usage()).startedAt
    const extras = [
      isShown('showResetIn') && resetMs !== null && resetMs > now ? `↻ ${durationLabel(resetMs - now)}` : null,
      isShown('showRate') && perHour !== null ? rateLabel(perHour) : null,
      isShown('showSessionTime') ? `sess ${durationLabel(now - began)}` : null,
    ].filter(Boolean).join(' · ')

    const gauges = (
      <Box>
        {bar('s', percent, BAR_CELLS)}
        <Text color={color} bold> {padCells(shown === null ? '—' : percentLabel(shown), PERCENT_WIDTH)}</Text>
        {week !== null ? (
          <Box>
            <Text dimColor> │ 7d </Text>
            {days.map((used, i) =>
              used ? <Text key={`d${i}`} color={dayColor(used)}>{CELL}</Text> : <Text key={`d${i}`} dimColor>{CELL}</Text>,
            )}
            <Text dimColor> {percentLabel(week)}</Text>
          </Box>
        ) : null}
        {extras ? <Text dimColor> │ {extras}</Text> : null}
        {demo ? (
          <Text dimColor>  demo {demoIndex + 1}/{DEMO.length} · {demo.label}</Text>
        ) : details ? (
          <Box display="none" hover={{ display: 'flex' }}>
            <Text dimColor>  {details}</Text>
          </Box>
        ) : null}
      </Box>
    )

    if ('isHidden' in skin) {
      return (
        <Box key="usage" paddingLeft={1}>
          {gauges}
        </Box>
      )
    }

    if ('tall' in skin) {
      const state = isHurt ? 'hurt' : isRefreshed ? 'refresh' : isKo ? 'ko' : isSleeping ? 'sleep' : doing ?? TALL_MOODS[tierFor(percent)]!
      const tall = TALL[skin.tall].draw(state, tick)
      const body = isKo ? MOODS[tierFor(100)]!.base : TALL[skin.tall].color
      const sideOn = (row: number) => (row === tall.sideRow
        ? <Text color={body} dimColor={isSleeping} bold>{tall.side}</Text>
        : null)
      return (
        <Box key="usage" flexDirection="column" paddingLeft={1}>
          <Text>
            <Text color={body} dimColor={isSleeping}>{tall.rows[0]}</Text>
            {sideOn(0)}
          </Text>
          <Box>
            <Text color={body} dimColor={isSleeping}>{padCells(tall.rows[1], cellWidth(tall.rows[1]) + 2)}</Text>
            {gauges}
          </Box>
          <Text>
            <Text color={body} dimColor={isSleeping}>{tall.rows[2]}</Text>
            {sideOn(2)}
          </Text>
        </Box>
      )
    }

    const frameNow = anim.frames[Math.floor(tick / anim.every) % anim.frames.length]!
    const face = drawFace(skin, frameNow)
    // Column sized to the current animation: the bar does not move during it and stays close to the face at rest
    const animWidth = Math.max(...anim.frames.map(fr => cellWidth(drawFace(skin, fr)))) + 1
    return (
      <Box key="usage" paddingLeft={1}>
        <Text color={isSleeping ? undefined : color} dimColor={isSleeping} bold>{padCells(face, animWidth)}</Text>
        {gauges}
      </Box>
    )
  })
}
