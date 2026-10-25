import type { Activity } from '../types'
import { type Drawing, type TallState, type Pixels, repeat, sceneOf, poseAt, isBlink, toSextants, paint } from './tall'

// The dino from Chrome's offline game, drawn in pixels on 3 lines, with the ground and its cacti
// scrolling past when it runs.

type Point = readonly [number, number]

const BODY: Pixels = [
  '......######',
  '.....#######',
  '.....#######',
  '#....####',
  '##..######',
  '.#########',
  '..#######',
  '',
  '',
]
// The tiny arm from the game: out of the chest, then hooked down
const ARM: Point[] = [[10, 5], [11, 5], [11, 6]]
// The eye is a hole in the head; the snout always stays whole
const EYES: Record<string, Point[]> = {
  open: [[7, 1]],
  closed: [],
  left: [[6, 1]],
  right: [[8, 1]],
  wide: [[7, 1], [8, 1]],
  happy: [[7, 1]],
  // K.O.: the big empty eye, as at the end of a game
  ko: [[7, 1], [8, 1]],
}
// Thin legs with forward-facing feet; when running, one is down and the other up
const LEGS: Record<string, Point[]> = {
  stand: [[3, 7], [3, 8], [4, 8], [7, 7], [7, 8], [8, 8]],
  left: [[3, 7], [3, 8], [4, 8], [7, 7], [8, 7]],
  right: [[3, 7], [4, 7], [7, 7], [7, 8], [8, 8]],
}
const WIDTH = 6
const GROUND = '▁▁▁▁▁▁ψ▁▁▁▁▁▁▁▁▁▁▁ψ▁▁▁▁▁▁▁▁ψ▁▁▁▁▁'
const GROUND_CELLS = 10

type Pose = {
  eyes?: keyof typeof EYES; legs?: keyof typeof LEGS; isRunning?: boolean
  ground?: string; side?: string; ticks: number
}

/** A cactus coming at `distance` cells from its feet. */
const cactusAt = (distance: number) => ' ' + '▁'.repeat(distance) + 'ψ' + '▁'.repeat(GROUND_CELLS - distance - 2)

const SCENES: Record<Exclude<TallState, Activity>, Pose[]> = {
  // Waiting for the game to start, smiling
  zen: [{ ticks: 6 }, { eyes: 'happy', ticks: 5 }, { ticks: 3 }, { eyes: 'right', ticks: 4 }, { ticks: 40 }],
  // Jogs for a moment, looks ahead, smiles
  good: [{ ticks: 5 }, { isRunning: true, ticks: 6 }, { ticks: 14 }, { eyes: 'right', ticks: 5 }, { ticks: 14 }, { eyes: 'happy', ticks: 4 }, { ticks: 16 }],
  // Restless: looks ahead and behind, stomps on the spot
  hmm: [
    { eyes: 'right', ticks: 4 }, { eyes: 'left', ticks: 4 }, { eyes: 'right', ticks: 3 },
    { legs: 'left', ticks: 2 }, { legs: 'right', ticks: 2 }, { legs: 'left', ticks: 2 }, { legs: 'right', ticks: 2 },
    { ticks: 3 }, { eyes: 'wide', ticks: 3 }, { eyes: 'right', ticks: 4 }, { ticks: 4 },
  ],
  // Running and sweating
  hot: repeat(2, [
    { isRunning: true, side: ' ;', ticks: 3 }, { isRunning: true, side: ' ,', ticks: 3 },
    { isRunning: true, eyes: 'wide', side: ' ;', ticks: 3 }, { isRunning: true, ticks: 3 },
  ]),
  // Running flat out, eyes wide
  panic: [
    { isRunning: true, eyes: 'wide', side: ' !', ticks: 2 },
    { isRunning: true, eyes: 'wide', side: ' !!', ticks: 2 },
  ],
  // Runs into a cactus
  flip: [
    ...[8, 6, 4, 2].map((d, i) => ({ eyes: 'wide' as const, ground: cactusAt(d), legs: i % 2 ? 'left' as const : 'right' as const, ticks: 2 })),
    { eyes: 'ko', ground: cactusAt(0), side: ' GAME OVER', ticks: 12 },
    { eyes: 'ko', ground: cactusAt(0), side: ' ↻', ticks: 6 },
  ],
  // Out of tokens: game lost, waiting for a restart
  ko: [' GAME OVER', ' GAME OVER', '', ' ↻'].map(side => ({ eyes: 'ko' as const, ground: cactusAt(0), side, ticks: 5 })),
  sleep: ['z', 'zZ', 'zzZ', ''].map(z => ({ eyes: 'closed' as const, side: ` ${z}`, ticks: 7 })),
  hurt: [{ eyes: 'ko', side: ' *', ticks: 2 }, { eyes: 'wide', ticks: 2 }],
  // The session resets: a happy dance
  refresh: [
    { eyes: 'happy', legs: 'left', side: ' ✧', ticks: 3 },
    { eyes: 'happy', legs: 'right', side: ' ✦', ticks: 3 },
  ],
}

/** What the dino does during each activity, frame by frame of the shared animation. */
const AT_WORK: Record<Activity, (i: number, side: string) => Omit<Pose, 'ticks' | 'side'>> = {
  // Runs while thinking, and opens its eye wide when it finds the idea
  think: (_, side) => (side.includes('!') ? { eyes: 'wide', isRunning: true } : { isRunning: true }),
  code: () => ({ isRunning: true }),
  read: () => ({ eyes: 'right' }),
  shell: () => ({ eyes: 'right' }),
  web: i => ({ eyes: i % 2 ? 'wide' : 'right', isRunning: true }),
  agent: () => ({ isRunning: true }),
  // Stomps while waiting
  wait: i => ({ legs: i % 2 ? 'left' : 'right' }),
}

/** The dino's 3 lines, top to bottom, the ground at its feet, and what sticks out right of its head, at `tick`. */
export const drawDino = (state: TallState, tick: number): Drawing => {
  const pose = poseAt(sceneOf(SCENES, AT_WORK, state), tick)
  const eyes = pose.eyes ?? 'open'
  const offset = pose.isRunning ? tick % GROUND.length : 0
  const ground = pose.ground ?? (GROUND + GROUND).slice(offset, offset + GROUND_CELLS)
  const legs = pose.legs ?? (pose.isRunning ? (tick % 4 < 2 ? 'left' : 'right') : 'stand')
  let px = paint(BODY, [...ARM, ...LEGS[legs]!], true)
  px = paint(px, EYES[isBlink(state, tick, eyes) ? 'closed' : eyes]!, false)
  const [top, middle, bottom] = toSextants(px, WIDTH)
  return { rows: [top, middle, bottom + ground], side: pose.side ?? '', sideRow: 0 }
}
