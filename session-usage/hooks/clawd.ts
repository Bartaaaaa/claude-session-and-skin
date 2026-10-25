import type { Activity } from '../types'
import { type Drawing, type TallState, repeat, sceneOf, poseAt, isBlink } from './tall'

// Clawd, the Claude Code mascot, has its own 3-line animations:
// a head (the eyes), a body (the arms) and legs.

const EYES = {
  open: ' ▐▛███▜▌',
  closed: ' ▐█████▌',
  left: ' ▐▛█▜██▌',
  right: ' ▐██▛█▜▌',
  wide: ' ▐▀███▀▌',
  happy: ' ▐▄███▄▌',
  ko: ' ▐×███×▌',
}
// Each arm: resting at shoulder height, lowered, or raised alongside the head
type Arm = 'rest' | 'down' | 'up'
const LEFT_ARM: Record<Arm, string> = { rest: '▝▜', down: '▗▟', up: ' ▜' }
const RIGHT_ARM: Record<Arm, string> = { rest: '▛▘', down: '▙▖', up: '▛ ' }
const ARMS = {
  rest: ['rest', 'rest'],
  up: ['up', 'up'],
  down: ['down', 'down'],
  waveLeft: ['up', 'rest'],
  waveRight: ['rest', 'up'],
  typeLeft: ['down', 'rest'],
  typeRight: ['rest', 'down'],
} satisfies Record<string, [Arm, Arm]>
const LEGS = {
  stand: ' ▝▝   ▘▘',
  step: '  ▘▘ ▝▝',
}

type Pose = { eyes?: keyof typeof EYES; arms?: keyof typeof ARMS; legs?: keyof typeof LEGS; side?: string; ticks: number }

const SCENES: Record<Exclude<TallState, Activity>, Pose[]> = {
  // Relaxed, humming and smiling
  zen: [{ ticks: 6 }, { side: ' ♪', ticks: 8 }, { ticks: 4 }, { eyes: 'happy', ticks: 6 }, { ticks: 40 }],
  // Glances left then right, taps a foot, smiles: a small gesture now and then
  good: [
    { ticks: 4 }, { eyes: 'left', ticks: 5 }, { ticks: 2 }, { eyes: 'right', ticks: 5 }, { ticks: 16 },
    { legs: 'step', ticks: 2 }, { ticks: 2 }, { legs: 'step', ticks: 2 }, { ticks: 16 }, { eyes: 'happy', ticks: 4 }, { ticks: 16 },
  ],
  // Pondering: looks around, scratches its head, taps a foot, wrings its claws
  hmm: [
    { eyes: 'left', ticks: 4 }, { eyes: 'right', ticks: 4 }, { eyes: 'left', ticks: 3 },
    { arms: 'waveRight', side: ' …', ticks: 3 }, { eyes: 'right', side: ' …', ticks: 2 }, { arms: 'waveRight', side: ' …', ticks: 3 }, { eyes: 'right', side: ' …', ticks: 2 },
    { legs: 'step', ticks: 2 }, { ticks: 2 }, { legs: 'step', ticks: 2 }, { ticks: 2 }, { legs: 'step', ticks: 2 }, { ticks: 3 },
    { arms: 'typeLeft', eyes: 'left', ticks: 3 }, { arms: 'typeRight', eyes: 'right', ticks: 3 }, { ticks: 4 },
  ],
  // Sweating and stomping
  hot: repeat(2, [{ side: ' ;', ticks: 2 }, { legs: 'step', side: ' ,', ticks: 3 }, { eyes: 'wide', side: ' ;', ticks: 2 }, { legs: 'step', ticks: 3 }]),
  // Running around waving its arms
  panic: [
    { eyes: 'wide', arms: 'up', legs: 'step', side: ' !', ticks: 2 },
    { eyes: 'wide', side: ' !!', ticks: 2 },
    { eyes: 'left', arms: 'up', side: ' !', ticks: 2 },
    { eyes: 'right', legs: 'step', side: ' !!', ticks: 2 },
  ],
  // Lifts the table, flips it and throws it
  flip: [
    { side: ' ┬─┬', ticks: 6 },
    { eyes: 'wide', arms: 'up', side: ' ┬─┬', ticks: 3 },
    ...['┻━┻', ' ┻━┻', '  ┻━┻', '   ┻━', '    ┻', ''].map(t => ({ eyes: 'wide' as const, arms: 'up' as const, side: ` ${t}`, ticks: 2 })),
    { eyes: 'wide', ticks: 6 },
  ],
  // Out of tokens: K.O. on its feet, groggy, claws dangling, stars around the head
  ko: ['  *', ' * ', '*  ', ' * '].map(stars => ({ eyes: 'ko' as const, arms: 'down' as const, side: ` ${stars}`, ticks: 4 })),
  sleep: ['z', 'zZ', 'zzZ', ''].map(z => ({ eyes: 'closed' as const, side: ` ${z}`, ticks: 7 })),
  hurt: [{ eyes: 'ko', side: ' *', ticks: 2 }, { eyes: 'ko', arms: 'down', ticks: 2 }],
  // The session resets: a happy dance
  refresh: [
    { eyes: 'happy', arms: 'up', side: ' ✧', ticks: 3 },
    { eyes: 'happy', arms: 'waveLeft', legs: 'step', side: ' ✦', ticks: 3 },
    { eyes: 'happy', arms: 'up', side: ' ✧', ticks: 3 },
    { eyes: 'happy', arms: 'waveRight', legs: 'step', side: ' ✦', ticks: 3 },
  ],
}

/** What Clawd's body does during each activity, frame by frame of the shared animation. */
const AT_WORK: Record<Activity, (i: number, side: string) => Omit<Pose, 'ticks' | 'side'>> = {
  // Paces up and down, and raises a claw when it finds the idea
  think: (i, side) => (side.includes('!') ? { eyes: 'wide', arms: 'waveLeft' } : { legs: i % 2 ? 'step' : 'stand' }),
  // Types, one claw after the other
  code: i => ({ arms: i % 2 ? 'typeLeft' : 'typeRight' }),
  read: () => ({ eyes: 'right' }),
  shell: () => ({ arms: 'typeRight' }),
  web: i => ({ eyes: i % 2 ? 'left' : 'right', legs: i % 2 ? 'step' : 'stand' }),
  agent: i => ({ arms: i % 2 ? 'waveLeft' : 'rest', legs: i % 2 ? 'stand' : 'step' }),
  // Taps a foot while waiting
  wait: i => ({ legs: i % 2 ? 'step' : 'stand' }),
}

/** Clawd's 3 lines, top to bottom, and what sticks out right of its head (`sideRow`), at `tick`. */
export const drawClawd = (state: TallState, tick: number): Drawing => {
  const pose = poseAt(sceneOf(SCENES, AT_WORK, state), tick)
  const eyes = pose.eyes ?? 'open'
  const head = EYES[isBlink(state, tick, eyes) ? 'closed' : eyes]
  const [left, right] = ARMS[pose.arms ?? 'rest']
  const body = LEFT_ARM[left] + '█████' + RIGHT_ARM[right]
  const withArms = ((left === 'up' ? '▐' : ' ') + head.slice(1) + (right === 'up' ? '▌' : '')).padEnd(9)
  const legs = LEGS[pose.legs ?? 'stand']
  return { rows: [withArms, body, legs] as const, side: pose.side ?? '', sideRow: 0 }
}
