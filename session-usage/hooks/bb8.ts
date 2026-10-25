import type { Activity } from '../types'
import { type Drawing, type TallState, type Pixels, repeat, sceneOf, poseAt, isBlink, toSextants, paint, besideHead } from './tall'

// BB-8, drawn in pixels on 3 lines: the dome head sitting on a rolling ball;
// the ball's pattern turns while the head stays on top.

type Point = readonly [number, number]

const BALL: Pixels = [
  '',
  '',
  '',
  '...######',
  '..########',
  '.##########',
  '.##########',
  '..########',
  '...######',
]
const DOME: Point[] = [[4, 0], [5, 0], [6, 0], [7, 0], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1]]
// The eye is a hole in the dome; when the head turns, the eye slides from edge to edge, then goes round the back
const EYES: Record<string, Point[]> = {
  open: [[6, 1]],
  closed: [],
  left: [[4, 1]],
  right: [[7, 1]],
  wide: [[5, 1], [6, 1]],
  happy: [[5, 0], [6, 1]],
  edgeLeft: [[3, 1]],
  midLeft: [[5, 1]],
  edgeRight: [[8, 1]],
}
const WIDTH = 9
const SIDE_AT = 5
// The ring of the real BB-8 goes round the ball: it comes in side-on from the left, crosses the front,
// leaves side-on on the right, then goes round the back. It follows the distance rolled: forward, backward, still when stopped.
const ring = (c: number): Point[] => [[c + 1, 4], [c + 2, 4], [c, 5], [c + 3, 5], [c, 6], [c + 3, 6], [c + 1, 7], [c + 2, 7]]
const TURN: Point[][] = [
  [[3, 4], [4, 5], [4, 6], [3, 7]],
  ring(2), ring(3), ring(4), ring(5), ring(6),
  [[8, 4], [7, 5], [7, 6], [8, 7]],
  [],
]

/** The ring after `distance` rolling steps; at 0 it faces front, slightly to the left. */
const markings = (distance: number): Point[] => TURN[(((distance + 1) % TURN.length) + TURN.length) % TURN.length]!

/** Distance rolled by the ball at `tick`: each frame adds its rolling direction. */
const distanceRolled = (scene: Pose[], tick: number) => {
  const length = scene.reduce((sum, p) => sum + p.ticks, 0)
  const perLoop = scene.reduce((sum, p) => sum + p.ticks * (p.roll ?? 0), 0)
  let rest = tick % length
  let distance = Math.floor(tick / length) * perLoop
  for (const p of scene) {
    const step = Math.min(rest, p.ticks)
    distance += step * (p.roll ?? 0)
    rest -= step
    if (rest <= 0) break
  }
  return distance
}

type Pose = {
  eyes?: keyof typeof EYES
  // The ball rolls right (1), left (-1), or stays still
  roll?: -1 | 0 | 1
  // Head offset: leaning while moving, or elsewhere when it flies off
  head?: readonly [number, number]
  side?: string; ticks: number
}

/** A full head turn: the eye crosses the dome, goes round the back and returns, while the ball rolls. */
const spin = (ticks: number): Pose[] =>
  (['left', 'midLeft', 'open', 'right', 'edgeRight', 'closed', 'closed', 'edgeLeft'] as const).map(eyes => ({ eyes, roll: 1, ticks }))

const SCENES: Record<Exclude<TallState, Activity>, Pose[]> = {
  // Looks around happily, and turns its head all the way round now and then
  zen: [{ ticks: 6 }, { eyes: 'left', ticks: 5 }, { ticks: 3 }, { eyes: 'happy', ticks: 5 }, { ticks: 50 }, ...spin(2), { ticks: 50 }],
  // Rolls a little, stops, looks behind then ahead
  good: [{ ticks: 5 }, { roll: 1, ticks: 8 }, { ticks: 14 }, { eyes: 'left', ticks: 6 }, { ticks: 16 }, { eyes: 'right', ticks: 5 }, { ticks: 18 }],
  // Hesitating: a head bob, a look each way, a roll, the eye widening
  hmm: [
    { eyes: 'left', head: [-1, 0], ticks: 5 }, { eyes: 'right', ticks: 5 }, { eyes: 'left', side: ' …', ticks: 4 },
    { side: ' …', ticks: 3 }, { roll: 1, ticks: 4 }, { roll: 1, ticks: 4 }, { eyes: 'wide', ticks: 4 },
    { eyes: 'right', ticks: 4 }, { ticks: 6 },
  ],
  // Rolling and sweating
  hot: repeat(2, [
    { roll: 1, side: ' ;', ticks: 4 }, { side: ' ,', ticks: 2 },
    { roll: 1, eyes: 'wide', side: ' ;', ticks: 4 }, { ticks: 2 },
  ]),
  // Speeding along, eye panicked
  panic: [
    { eyes: 'wide', roll: 1, side: ' !', ticks: 2 },
    { eyes: 'wide', roll: 1, side: ' !!', ticks: 2 },
    { eyes: 'left', roll: 1, side: ' !', ticks: 2 },
    { eyes: 'right', roll: 1, side: ' !!', ticks: 2 },
  ],
  // Rolling too fast: its head flies off the front and lands beside it, then it puts it back
  flip: [
    { eyes: 'wide', roll: 1, ticks: 6 },
    ...([[3, 0], [6, 0], [9, 0], [9, 2], [9, 4], [9, 7]] as const).map(head => ({ eyes: 'wide' as const, roll: 1 as const, head, ticks: 2 })),
    { eyes: 'wide', head: [9, 7], side: ' !', ticks: 8 },
    ...spin(2),
    { eyes: 'happy', ticks: 6 },
  ],
  // Out of tokens: its head has fallen on the floor next to the ball
  ko: ['  *', ' * ', '*  ', ' * '].map(stars => ({ eyes: 'closed' as const, head: [9, 7] as const, side: ` ${stars}`, ticks: 4 })),
  // Lowers its head to sleep
  sleep: ['z', 'zZ', 'zzZ', ''].map(z => ({ eyes: 'closed' as const, head: [0, 1] as const, side: ` ${z}`, ticks: 7 })),
  hurt: [{ eyes: 'wide', side: ' *', ticks: 2 }, { eyes: 'closed', ticks: 2 }],
  // The session resets: spins around with joy
  refresh: [...spin(1).map((p, i) => ({ ...p, side: i % 2 ? ' ✦' : ' ✧' })), { eyes: 'happy', side: ' ✧', ticks: 4 }],
}

/** What BB-8 does during each activity, frame by frame of the shared animation. */
const AT_WORK: Record<Activity, (i: number, side: string) => Omit<Pose, 'ticks' | 'side'>> = {
  // Rolls while thinking, and opens its eye wide when it finds the idea
  think: (_, side) => (side.includes('!') ? { eyes: 'wide' } : { roll: 1 }),
  code: () => ({ roll: 1 }),
  read: () => ({ eyes: 'right' }),
  shell: () => ({ eyes: 'right' }),
  web: i => ({ eyes: i % 2 ? 'left' : 'right', roll: 1 }),
  // Turns its head to follow its agents
  agent: i => ({ eyes: (['left', 'open', 'right', 'closed'] as const)[i % 4], roll: 1 }),
  // Keeps an eye on its agents
  wait: i => ({ eyes: i % 2 ? 'left' : 'open' }),
}

/** BB-8's 3 lines, top to bottom, and what sticks out right of its head, at `tick`. */
export const drawBb8 = (state: TallState, tick: number): Drawing => {
  const scene = sceneOf(SCENES, AT_WORK, state)
  const pose = poseAt(scene, tick)
  const eyes = pose.eyes ?? 'open'
  const [dx, dy] = pose.head ?? [0, 0]
  const at = (points: Point[]) => points.map(([x, y]) => [x + dx, y + dy] as const)
  let px = paint(BALL, markings(distanceRolled(scene, tick)), false)
  px = paint(px, at(DOME), true)
  px = paint(px, at(EYES[isBlink(state, tick, eyes) ? 'closed' : eyes]!), false)
  const [top, middle, bottom] = toSextants(px, WIDTH)
  return { rows: [besideHead(top, SIDE_AT), middle, bottom], side: pose.side ?? '', sideRow: 0 }
}
