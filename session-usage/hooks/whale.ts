import type { Activity } from '../types'
import { type Drawing, type TallState, type Pixels, repeat, sceneOf, poseAt, isBlink, toSextants, paint, besideHead } from './tall'

// The whale half under water, drawn in pixels on 3 lines: the tail out of the water on the left,
// the back and the eye on the right, the spout above, the waves below.

type Point = readonly [number, number]

const BACK: Pixels = [
  '',
  '',
  '',
  '.............#########',
  '..........###############',
  '........###################',
  '........#####################',
  '',
  '',
]
// The eye is a hole in the back
const EYES: Record<string, Point[]> = {
  open: [[21, 5]],
  closed: [[20, 5], [21, 5]],
  left: [[20, 5]],
  right: [[22, 5]],
  wide: [[21, 4], [21, 5]],
  happy: [[20, 5], [21, 4], [22, 5]],
  ko: [[20, 4], [22, 4], [21, 5], [20, 6], [22, 6]],
}
// The tail fluke: raised out of the water, or flat on the waves
const TAILS: Record<string, Point[]> = {
  up: [[0, 0], [5, 0], [1, 1], [2, 1], [4, 1], [5, 1], [2, 2], [3, 2], [4, 2], [3, 3], [3, 4], [3, 5]],
  low: [[0, 3], [5, 3], [1, 4], [2, 4], [4, 4], [5, 4], [2, 5], [3, 5], [4, 5]],
}
const SPOUTS: Record<string, Point[]> = {
  none: [],
  small: [[21, 2]],
  mid: [[21, 2], [20, 1], [22, 1]],
  big: [[21, 2], [20, 1], [22, 1], [19, 0], [21, 0], [23, 0]],
}
const WIDTH = 15
const SIDE_AT = 13
// The sea follows the mood: barely a ripple when calm, rougher and rougher
const WAVE_TICKS: Partial<Record<TallState, number>> = { zen: 10, good: 7, hmm: 5, sleep: 10, ko: 10, hot: 3, panic: 2, flip: 2 }

/** The waves, sliding one pixel every `every` frames. */
const waves = (tick: number, every: number): Point[] => {
  const phase = Math.floor(tick / every) % 3
  const points: Point[] = []
  for (let x = 0; x < 29; x++) {
    if (x < 8 && (x + phase) % 3 !== 1) points.push([x, 6])
    if ((x + phase) % 3 === 1) points.push([x, 7])
  }
  return points
}

type Pose = { eyes?: keyof typeof EYES; tail?: keyof typeof TAILS; spout?: keyof typeof SPOUTS; side?: string; ticks: number }

const SCENES: Record<Exclude<TallState, Activity>, Pose[]> = {
  // Blows gently, then smiles
  zen: [
    { ticks: 6 }, { spout: 'small', ticks: 2 }, { spout: 'mid', ticks: 2 }, { spout: 'big', ticks: 4 }, { spout: 'mid', ticks: 2 },
    { ticks: 4 }, { eyes: 'happy', ticks: 6 }, { ticks: 40 },
  ],
  // Glances back, flaps its tail twice, then blows a little
  good: [
    { ticks: 5 }, { eyes: 'left', ticks: 6 }, { tail: 'low', ticks: 3 }, { ticks: 3 }, { tail: 'low', ticks: 3 }, { eyes: 'right', ticks: 6 },
    { ticks: 14 }, { spout: 'small', ticks: 2 }, { spout: 'mid', ticks: 3 }, { ticks: 20 },
  ],
  // Restless: looks around, lets out bubbles, flaps its tail, blows in bursts
  hmm: [
    { eyes: 'left', ticks: 4 }, { eyes: 'right', ticks: 4 }, { eyes: 'left', side: ' o', ticks: 3 }, { side: ' o°', ticks: 3 },
    { tail: 'low', side: ' o°', ticks: 2 }, { side: ' °', ticks: 2 }, { tail: 'low', ticks: 2 }, { ticks: 2 }, { tail: 'low', ticks: 2 },
    { eyes: 'right', ticks: 4 }, { spout: 'small', ticks: 2 }, { ticks: 3 }, { spout: 'small', ticks: 2 }, { ticks: 5 },
  ],
  // Sweating, short of breath, flapping its tail
  hot: repeat(2, [
    { spout: 'small', side: ' ;', ticks: 2 }, { tail: 'low', spout: 'mid', side: ' ,', ticks: 3 },
    { eyes: 'wide', spout: 'small', side: ' ;', ticks: 2 }, { tail: 'low', ticks: 3 },
  ]),
  // Blowing frantically while flapping its tail
  panic: [
    { eyes: 'wide', tail: 'low', spout: 'big', side: ' !', ticks: 2 },
    { eyes: 'wide', spout: 'mid', side: ' !!', ticks: 2 },
    { eyes: 'left', tail: 'low', spout: 'big', side: ' !', ticks: 2 },
    { eyes: 'right', spout: 'mid', side: ' !!', ticks: 2 },
  ],
  // Rams the table and sends it flying with a headbutt
  flip: [
    { side: ' ┬─┬', ticks: 6 },
    { eyes: 'wide', tail: 'low', side: ' ┬─┬', ticks: 3 },
    ...['┻━┻', ' ┻━┻', '  ┻━┻', '   ┻━', '    ┻', ''].map((t, i) => ({
      eyes: 'wide' as const, tail: i % 2 ? 'up' as const : 'low' as const, spout: 'big' as const, side: ` ${t}`, ticks: 2,
    })),
    { eyes: 'wide', ticks: 6 },
  ],
  // Out of tokens: tail down, crossed-out eyes, stars around the head
  ko: ['  *', ' * ', '*  ', ' * '].map(stars => ({ eyes: 'ko' as const, tail: 'low' as const, side: ` ${stars}`, ticks: 4 })),
  sleep: ['z', 'zZ', 'zzZ', ''].map(z => ({ eyes: 'closed' as const, side: ` ${z}`, ticks: 7 })),
  hurt: [{ eyes: 'ko', side: ' *', ticks: 2 }, { eyes: 'ko', tail: 'low', ticks: 2 }],
  // The session resets: a big happy spout
  refresh: [
    { eyes: 'happy', spout: 'big', side: ' ✧', ticks: 3 },
    { eyes: 'happy', tail: 'low', spout: 'mid', side: ' ✦', ticks: 3 },
    { eyes: 'happy', spout: 'big', side: ' ✧', ticks: 3 },
    { eyes: 'happy', tail: 'low', spout: 'mid', side: ' ✦', ticks: 3 },
  ],
}

const swim = (i: number) => (i % 2 ? 'low' : 'up')

/** What the whale does during each activity, frame by frame of the shared animation. */
const AT_WORK: Record<Activity, (i: number, side: string) => Omit<Pose, 'ticks' | 'side'>> = {
  // Swims while thinking, and blows when it finds the idea
  think: (i, side) => (side.includes('!') ? { eyes: 'wide', spout: 'big' } : { tail: swim(i) }),
  code: i => ({ tail: swim(i) }),
  read: () => ({ eyes: 'right' }),
  shell: () => ({ tail: 'low' }),
  web: i => ({ eyes: i % 2 ? 'left' : 'right', tail: swim(i) }),
  agent: i => ({ tail: swim(i + 1) }),
  wait: i => ({ tail: swim(i) }),
}

/** The whale's 3 lines, top to bottom, and what sticks out right of its head, at `tick`. */
export const drawWhale = (state: TallState, tick: number): Drawing => {
  const pose = poseAt(sceneOf(SCENES, AT_WORK, state), tick)
  const eyes = pose.eyes ?? 'open'
  let px = paint(BACK, [...TAILS[pose.tail ?? 'up']!, ...SPOUTS[pose.spout ?? 'none']!, ...waves(tick, WAVE_TICKS[state] ?? 4)], true)
  px = paint(px, EYES[isBlink(state, tick, eyes) ? 'closed' : eyes]!, false)
  const [top, middle, bottom] = toSextants(px, WIDTH)
  return { rows: [besideHead(top, SIDE_AT), middle, bottom], side: pose.side ?? '', sideRow: 0 }
}
