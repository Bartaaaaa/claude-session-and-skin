import type { Activity } from '../types'
import { type Drawing, type TallState, type Pixels, repeat, sceneOf, poseAt, toSextants, paint, besideHead } from './tall'

// The Among Us crewmate, side view facing right, drawn in pixels on 3 lines:
// the backpack on the left, the solid visor sticking out on the right, the legs below.

type Point = readonly [number, number]

const BODY: Pixels = [
  '....######',
  '...########',
  '..####',
  '####..#######',
  '####..#######',
  '#####',
  '###########',
  '',
  '',
]
// The reported body: the lower half, with a bone sticking out
const DEAD: Pixels = [
  '',
  '',
  '',
  '',
  '......#',
  '.....###',
  '###########',
  '',
  '',
]
// It has no eyes: to look behind, it turns around
type Look = 'ahead' | 'back'
const LEGS: Record<string, Point[]> = {
  stand: [[1, 7], [2, 7], [3, 7], [4, 7], [7, 7], [8, 7], [9, 7], [10, 7], [1, 8], [2, 8], [3, 8], [4, 8], [7, 8], [8, 8], [9, 8], [10, 8]],
  stride: [[0, 7], [1, 7], [2, 7], [3, 7], [8, 7], [9, 7], [10, 7], [11, 7], [0, 8], [1, 8], [2, 8], [9, 8], [10, 8], [11, 8]],
}
const WIDTH = 7

type Pose = {
  look?: Look; legs?: keyof typeof LEGS; isDead?: boolean
  side?: string; ticks: number
}

const SCENES: Record<Exclude<TallState, Activity>, Pose[]> = {
  // Waits calmly, turns around for a moment, then takes a step
  zen: [{ ticks: 6 }, { look: 'back', ticks: 6 }, { ticks: 4 }, { legs: 'stride', ticks: 2 }, { ticks: 40 }],
  // Takes a few steps, looks behind, moves on
  good: [
    { ticks: 5 }, { legs: 'stride', ticks: 3 }, { ticks: 3 }, { legs: 'stride', ticks: 3 }, { ticks: 3 },
    { look: 'back', ticks: 6 }, { ticks: 16 }, { legs: 'stride', ticks: 2 }, { ticks: 16 },
  ],
  // Someone is sus: keeps turning around and stomping
  hmm: [
    { look: 'back', ticks: 5 }, { ticks: 3 }, { look: 'back', side: ' sus', ticks: 4 }, { side: ' sus', ticks: 3 }, { look: 'back', side: ' sus', ticks: 3 },
    { legs: 'stride', ticks: 2 }, { ticks: 2 }, { legs: 'stride', ticks: 2 }, { look: 'back', ticks: 3 }, { look: 'back', legs: 'stride', ticks: 2 },
    { look: 'back', ticks: 3 }, { ticks: 4 },
  ],
  // Rushing through tasks, sweating
  hot: repeat(2, [
    { side: ' ;', ticks: 2 }, { legs: 'stride', side: ' ,', ticks: 3 },
    { side: ' ;', ticks: 2 }, { legs: 'stride', ticks: 3 },
  ]),
  // The sabotage alarm goes off: running all over the place
  panic: [
    { legs: 'stride', side: ' ⚠', ticks: 2 },
    { side: ' ⚠ !', ticks: 2 },
    { look: 'back', legs: 'stride', side: ' ⚠', ticks: 2 },
    { side: '', ticks: 2 },
  ],
  // Emergency meeting: spinning around in a panic while the alert shows
  flip: [
    { side: ' ⚠', ticks: 4 },
    { look: 'back', side: ' ⚠ EMERGENCY', ticks: 2 },
    { side: ' ⚠ EMERGENCY', ticks: 2 },
    { look: 'back', side: ' ⚠ EMERGENCY MEETING', ticks: 2 },
    { side: ' ⚠ EMERGENCY MEETING', ticks: 8 },
    { side: '', ticks: 3 },
  ],
  // Out of tokens: only half of it is left, and someone reports the body
  ko: [' R', ' RE', ' REPO', ' REPORT', ' REPORT', ''].map(side => ({ isDead: true, side, ticks: 4 })),
  sleep: ['z', 'zZ', 'zzZ', ''].map(z => ({ side: ` ${z}`, ticks: 7 })),
  // The hit spins it around
  hurt: [{ look: 'back', side: ' *', ticks: 2 }, { ticks: 2 }],
  // The session resets: a dance, a step, a half-turn, a step
  refresh: [
    { legs: 'stride', side: ' ✧', ticks: 3 },
    { look: 'back', side: ' ✦', ticks: 3 },
    { look: 'back', legs: 'stride', side: ' ✧', ticks: 3 },
    { side: ' ✦', ticks: 3 },
  ],
}

const walk = (i: number) => (i % 2 ? 'stride' : 'stand')

/** What the crewmate does during each activity, frame by frame of the shared animation. */
const AT_WORK: Record<Activity, (i: number, side: string) => Omit<Pose, 'ticks' | 'side'>> = {
  // Paces up and down, and turns around when it finds the idea
  think: (i, side) => (side.includes('!') ? { look: 'back' } : { legs: walk(i) }),
  // Does its tasks on the spot
  code: () => ({}),
  read: () => ({}),
  shell: () => ({}),
  web: i => ({ look: i % 2 ? 'back' : 'ahead', legs: walk(i) }),
  agent: i => ({ legs: walk(i + 1) }),
  // Taps a foot while waiting
  wait: i => ({ legs: walk(i) }),
}

/** The crewmate's 3 lines, top to bottom, and what sticks out right of its head, at `tick`. */
export const drawCrewmate = (state: TallState, tick: number): Drawing => {
  const pose = poseAt(sceneOf(SCENES, AT_WORK, state), tick)
  let px = paint(pose.isDead ? DEAD : BODY, LEGS[pose.legs ?? 'stand']!, true)
  if (pose.look === 'back') px = px.map(row => [...row.padEnd(WIDTH * 2, '.')].reverse().join(''))
  const [top, middle, bottom] = toSextants(px, WIDTH)
  return { rows: [besideHead(top, WIDTH), middle, bottom], side: pose.side ?? '', sideRow: 0 }
}
