import type { Activity } from '../types'
import { ACTIVITIES, padCells } from './look'

// The shared engine of the 3-line characters: each one describes its scenes frame by frame,
// and this engine picks the current frame and makes the eyes blink.

export type TallState = 'zen' | 'good' | 'hmm' | 'hot' | 'panic' | 'flip' | 'ko' | 'sleep' | 'hurt' | 'refresh' | Activity

/** The character state for each mood, in MOODS order. */
export const TALL_MOODS: TallState[] = ['zen', 'good', 'hmm', 'hot', 'panic', 'flip', 'ko']

/** The 3 lines, top to bottom, and what sticks out to the right of line `sideRow`. */
export type Drawing = { rows: readonly [string, string, string]; side: string; sideRow: number }

type Timed = { side?: string; ticks: number }

export const repeat = <P>(times: number, poses: P[]) => Array.from({ length: times }, () => poses).flat()

/** The frames of a state: its scene, or for an activity the shared animation where `atWork` poses the body. */
export const sceneOf = <P extends Timed>(
  scenes: Record<Exclude<TallState, Activity>, P[]>,
  atWork: Record<Activity, (i: number, side: string) => Omit<P, 'ticks' | 'side'>>,
  state: TallState,
): P[] =>
  state in scenes
    ? scenes[state as keyof typeof scenes]
    : ACTIVITIES[state as Activity].frames.map((fr, i) => {
        const side = fr.post ? ` ${fr.post.trimStart()}` : ''
        return { ...atWork[state as Activity](i, side), side, ticks: ACTIVITIES[state as Activity].every } as P
      })

export const poseAt = <P extends Timed>(scene: P[], tick: number): P => {
  let t = tick % scene.reduce((sum, p) => sum + p.ticks, 0)
  for (const p of scene) {
    if (t < p.ticks) return p
    t -= p.ticks
  }
  return scene[0]!
}

const BLINK_EVERY = 27
const NO_BLINK: TallState[] = ['sleep', 'ko', 'hurt']

/** A short regular blink, one frame long, only when the eyes are plainly open. */
export const isBlink = (state: TallState, tick: number, eyes: string) =>
  eyes === 'open' && !NO_BLINK.includes(state) && tick % BLINK_EVERY === BLINK_EVERY - 1

/** A pixel drawing, row by row: `#` on, anything else off. 9 rows for 3 text lines. */
export type Pixels = string[]

const sextant = (v: number) =>
  v === 0 ? ' ' : v === 21 ? '▌' : v === 42 ? '▐' : v === 63 ? '█' : String.fromCodePoint(0x1fb00 + v - 1 - (v > 21 ? 1 : 0) - (v > 42 ? 1 : 0))

/** The pixels as 3 lines of sextants, 2 × 3 pixels per character, each `cells` characters wide so nothing beside them moves. */
export const toSextants = (px: Pixels, cells: number): readonly [string, string, string] => {
  const width = cells * 2
  const on = (x: number, y: number) => (px[y]?.[x] === '#' ? 1 : 0)
  const row = (y: number) => {
    let s = ''
    for (let x = 0; x < width; x += 2) {
      s += sextant(on(x, y) | on(x + 1, y) << 1 | on(x, y + 1) << 2 | on(x + 1, y + 1) << 3 | on(x, y + 2) << 4 | on(x + 1, y + 2) << 5)
    }
    return s
  }
  return [row(0), row(3), row(6)]
}

/** What follows the bubble line starts at column `cells`, right after the head, unless the drawing is wider. */
export const besideHead = (row: string, cells: number) => padCells(row.trimEnd(), cells)

/** The pixels with those at `points` switched on (`on`) or off. */
export const paint = (px: Pixels, points: readonly (readonly [number, number])[], on: boolean): Pixels => {
  const grid = px.map(r => [...r])
  for (const [x, y] of points) {
    const line = grid[y]
    if (!line) continue
    while (line.length <= x) line.push('.')
    line[x] = on ? '#' : '.'
  }
  return grid.map(r => r.join(''))
}
