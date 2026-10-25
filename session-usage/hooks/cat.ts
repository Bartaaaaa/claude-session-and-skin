import type { Activity } from '../types'
import { type Drawing, type TallState, type Pixels, repeat, sceneOf, poseAt, isBlink, toSextants, paint, besideHead } from './tall'

// The cat sitting face on, drawn in pixels on 3 lines: ears, head, body, paws, and the tail on the right.

type Point = readonly [number, number]

const BODY: Pixels = [
  '',
  '',
  '.#########',
  '.#########',
  '.#########',
  '..#######',
  '..#######',
  '.#########',
  '....###',
]
// The eyes are holes in the head
const EYES: Record<string, Point[]> = {
  open: [[3, 3], [7, 3]],
  closed: [[2, 3], [3, 3], [7, 3], [8, 3]],
  left: [[2, 3], [6, 3]],
  right: [[4, 3], [8, 3]],
  wide: [[3, 3], [3, 4], [7, 3], [7, 4]],
  happy: [[2, 4], [3, 3], [4, 4], [6, 4], [7, 3], [8, 4]],
  // Knocked out: eyes shut; 1-pixel crossed eyes would look like the happy eyes
  ko: [[2, 3], [3, 3], [7, 3], [8, 3]],
}
const EARS: Record<string, Point[]> = {
  up: [[1, 0], [9, 0], [1, 1], [2, 1], [8, 1], [9, 1]],
  // Ears flattened when upset
  flat: [[0, 1], [1, 1], [9, 1], [10, 1]],
  twitch: [[0, 1], [1, 1], [9, 0], [8, 1], [9, 1]],
}
// Front paws: down, one lifted to type, or reaching out to lick or swipe
const PAWS: Record<string, Point[]> = {
  sit: [[1, 8], [2, 8], [8, 8], [9, 8]],
  left: [[8, 8], [9, 8]],
  right: [[1, 8], [2, 8]],
  lick: [[1, 8], [2, 8], [9, 6], [10, 5], [11, 4]],
}
const TAILS: Record<string, Point[]> = {
  curl: [[17, 3], [16, 4], [16, 5], [15, 6], [13, 7], [14, 7], [11, 8], [12, 8]],
  high: [[14, 1], [13, 2], [12, 3], [12, 4], [12, 5], [12, 6], [11, 7], [11, 8]],
  low: [[11, 8], [12, 8], [13, 8], [14, 8], [15, 8], [16, 7], [17, 7]],
}
const WIDTH = 9
const SIDE_AT = 8

type Pose = {
  eyes?: keyof typeof EYES; ears?: keyof typeof EARS; paws?: keyof typeof PAWS; tail?: keyof typeof TAILS
  side?: string; sideRow?: number; ticks: number
}

const SCENES: Record<Exclude<TallState, Activity>, Pose[]> = {
  // Purring and blinking contentedly
  zen: [{ ticks: 6 }, { side: ' ♪', ticks: 8 }, { ticks: 4 }, { eyes: 'happy', side: ' ♪', ticks: 6 }, { ticks: 40 }],
  // Looks left then right, an ear twitches, the tail sweeps the floor
  good: [
    { ticks: 5 }, { eyes: 'left', ticks: 6 }, { ticks: 3 }, { eyes: 'right', tail: 'high', ticks: 6 }, { ticks: 14 },
    { ears: 'twitch', ticks: 2 }, { ticks: 3 }, { ears: 'twitch', ticks: 2 }, { ticks: 14 }, { tail: 'low', ticks: 3 }, { ticks: 16 },
  ],
  // Getting impatient: looks around, licks a paw, lashes its tail, ears twitching
  hmm: [
    { eyes: 'left', ears: 'twitch', ticks: 4 }, { eyes: 'right', tail: 'high', ticks: 4 }, { eyes: 'left', ticks: 3 },
    { eyes: 'closed', paws: 'lick', ticks: 3 }, { eyes: 'closed', ticks: 2 }, { eyes: 'closed', paws: 'lick', ticks: 3 }, { eyes: 'closed', ticks: 2 },
    { tail: 'high', ticks: 3 }, { tail: 'low', ticks: 3 }, { tail: 'high', ears: 'twitch', ticks: 3 }, { eyes: 'right', ticks: 4 }, { ticks: 4 },
  ],
  // Ears flat, sweating and lashing its tail
  hot: repeat(2, [
    { ears: 'flat', side: ' ;', ticks: 2 }, { ears: 'flat', tail: 'high', side: ' ,', ticks: 3 },
    { ears: 'flat', eyes: 'wide', side: ' ;', ticks: 2 }, { ears: 'flat', tail: 'low', ticks: 3 },
  ]),
  // Fur on end, tail up
  panic: [
    { eyes: 'wide', ears: 'flat', tail: 'high', side: ' !', ticks: 2 },
    { eyes: 'wide', tail: 'high', side: ' !!', ticks: 2 },
    { eyes: 'left', ears: 'flat', tail: 'high', side: ' !', ticks: 2 },
    { eyes: 'right', tail: 'high', side: ' !!', ticks: 2 },
  ],
  // Stares at the glass, pushes it with a paw until it falls and breaks
  flip: [
    { side: '▯', ticks: 8 },
    { eyes: 'right', side: '▯', ticks: 6 },
    { eyes: 'right', paws: 'lick', side: '▯', ticks: 4 },
    { eyes: 'right', side: '▯', ticks: 2 },
    { eyes: 'right', paws: 'lick', side: ' ▯', ticks: 3 },
    { eyes: 'right', paws: 'lick', side: '  ▯', ticks: 3 },
    { eyes: 'right', side: '   ▯', ticks: 2 },
    { eyes: 'wide', side: '    ▯', sideRow: 2, ticks: 2 },
    { eyes: 'wide', side: '    ✶', sideRow: 2, ticks: 4 },
    { eyes: 'happy', ticks: 8 },
  ],
  // Out of tokens: sitting but groggy, ears flat, tail down, stars around the head
  ko: ['  *', ' * ', '*  ', ' * '].map(stars => ({ eyes: 'ko' as const, ears: 'flat' as const, tail: 'low' as const, side: ` ${stars}`, ticks: 4 })),
  sleep: ['z', 'zZ', 'zzZ', ''].map(z => ({ eyes: 'closed' as const, side: ` ${z}`, ticks: 7 })),
  hurt: [{ eyes: 'ko', side: ' *', ticks: 2 }, { eyes: 'ko', ears: 'flat', ticks: 2 }],
  // The session resets: hops with joy, one paw then the other
  refresh: [
    { eyes: 'happy', tail: 'high', side: ' ✧', ticks: 3 },
    { eyes: 'happy', paws: 'left', side: ' ✦', ticks: 3 },
    { eyes: 'happy', tail: 'high', side: ' ✧', ticks: 3 },
    { eyes: 'happy', paws: 'right', side: ' ✦', ticks: 3 },
  ],
}

/** What the cat does during each activity, frame by frame of the shared animation. */
const AT_WORK: Record<Activity, (i: number, side: string) => Omit<Pose, 'ticks' | 'side'>> = {
  // Its tail sways while thinking, and goes up when it finds the idea
  think: (i, side) => (side.includes('!') ? { eyes: 'wide', tail: 'high' } : { tail: i % 2 ? 'high' : 'curl' }),
  // Types, one paw after the other
  code: i => ({ paws: i % 2 ? 'left' : 'right' }),
  read: () => ({ eyes: 'right' }),
  shell: () => ({ paws: 'right' }),
  web: i => ({ eyes: i % 2 ? 'left' : 'right', ears: i % 2 ? 'twitch' : 'up' }),
  agent: i => ({ tail: i % 2 ? 'high' : 'curl' }),
  // Taps its tail while waiting
  wait: i => ({ tail: i % 2 ? 'low' : 'curl' }),
}

/** The cat's 3 lines, top to bottom, and what sticks out on the right (`sideRow`), at `tick`. */
export const drawCat = (state: TallState, tick: number): Drawing => {
  const pose = poseAt(sceneOf(SCENES, AT_WORK, state), tick)
  const eyes = pose.eyes ?? 'open'
  let px = paint(BODY, [...EARS[pose.ears ?? 'up']!, ...PAWS[pose.paws ?? 'sit']!, ...TAILS[pose.tail ?? 'curl']!], true)
  px = paint(px, EYES[isBlink(state, tick, eyes) ? 'closed' : eyes]!, false)
  const sideRow = pose.sideRow ?? 0
  const rows = [...toSextants(px, WIDTH)]
  rows[sideRow] = besideHead(rows[sideRow]!, sideRow === 0 ? SIDE_AT : WIDTH)
  return { rows: rows as unknown as Drawing['rows'], side: pose.side ?? '', sideRow }
}
