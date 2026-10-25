import { test, expect } from 'claude-code/testing'
import { drawWhale } from '../hooks/whale'
import { drawCat } from '../hooks/cat'
import { drawCrewmate } from '../hooks/crewmate'
import { drawDino } from '../hooks/dino'
import { drawBb8 } from '../hooks/bb8'

const SPRITES = [drawWhale, drawCat, drawCrewmate, drawDino, drawBb8]
import { TALL_MOODS, toSextants } from '../hooks/tall'
import { drawClawd } from '../hooks/clawd'
import { cellWidth } from '../hooks/look'

const STATES = [...TALL_MOODS, 'sleep', 'hurt', 'refresh', 'think', 'code', 'read', 'shell', 'web', 'agent', 'wait'] as const

test('pixels become sextants, 2 × 3 pixels per character', async () => {
  expect(toSextants(['##', '##', '##', '#.', '#.', '#.', '.#', '.#', '.#'], 1)).toEqual(['█', '▌', '▐'])
  expect(toSextants(['#.', '..', '..'], 1)[0]).toBe('\u{1fb00}')
})

test('the cat keeps 3 full lines, the whale its back and waves, in every state', async () => {
  for (const state of STATES) {
    for (let tick = 0; tick < 60; tick++) {
      for (const row of drawCat(state, tick).rows) expect(row.trim().length).toBeGreaterThan(0)
      for (const row of drawWhale(state, tick).rows.slice(1)) expect(row.trim().length).toBeGreaterThan(0)
    }
  }
})

test('every character moves in every mood', async () => {
  for (const draw of SPRITES) {
    for (const state of TALL_MOODS) {
      const poses = new Set(Array.from({ length: 80 }, (_, tick) => JSON.stringify(draw(state, tick))))
      expect(poses.size).toBeGreaterThan(2)
    }
  }
})

test('the whale blows at rest', async () => {
  const tops = new Set(Array.from({ length: 30 }, (_, tick) => drawWhale('zen', tick).rows[0]))
  expect(tops.size).toBeGreaterThan(1)
})

test('the K.O. cat stays seated, groggy, stars around its head', async () => {
  const ko = drawCat('ko', 0)
  expect(ko.sideRow).toBe(0)
  expect(ko.side).toContain('*')
  expect(ko.rows[0]).not.toBe(drawCat('zen', 0).rows[0])
})

test('the cat knocks the glass off the table', async () => {
  const frames = Array.from({ length: 40 }, (_, tick) => drawCat('flip', tick))
  expect(frames.some(f => f.sideRow === 0 && f.side.includes('▯'))).toBe(true)
  expect(frames.some(f => f.sideRow === 2 && f.side.includes('✶'))).toBe(true)
  expect(frames.some(f => f.side === '▯' && [...f.rows[0]][7] !== ' ')).toBe(true)
})

test('bubbles always start at the same column, and the gauge does not move', async () => {
  for (const draw of [...SPRITES, drawClawd]) {
    const bubbleAt = new Map<number, Set<number>>()
    const gaugeAt = new Set<number>()
    for (const state of STATES) {
      for (let tick = 0; tick < 100; tick++) {
        const d = draw(state, tick)
        gaugeAt.add(cellWidth(d.rows[1]))
        if (!d.side.trim()) continue
        const at = bubbleAt.get(d.sideRow) ?? new Set<number>()
        at.add(cellWidth(d.rows[d.sideRow]!))
        bubbleAt.set(d.sideRow, at)
      }
    }
    expect(gaugeAt.size).toBe(1)
    for (const at of bubbleAt.values()) expect(at.size).toBe(1)
  }
})

test('bubbles stay next to the head', async () => {
  for (const draw of [drawBb8, drawCat, drawCrewmate, drawDino, drawWhale]) {
    const d = draw('think', 4)
    const head = Math.max(cellWidth(d.rows[0].trimEnd()), cellWidth(d.rows[1].trimEnd()))
    expect(cellWidth(d.rows[0]) - head).toBeLessThan(3)
  }
})

test('BB-8 turns its head all the way round at rest', async () => {
  const tops = Array.from({ length: 100 }, (_, tick) => drawBb8('zen', tick).rows[0])
  expect(new Set(tops).size).toBeGreaterThan(5)
})

test('the crewmate, the dino and BB-8 keep their body in every state', async () => {
  for (const draw of [drawCrewmate, drawDino, drawBb8]) {
    for (const state of STATES) {
      for (let tick = 0; tick < 60; tick++) expect(draw(state, tick).rows[2].trim().length).toBeGreaterThan(0)
    }
  }
})

test('the dino runs: the ground and its cacti scroll past', async () => {
  const grounds = new Set(Array.from({ length: 12 }, (_, tick) => drawDino('code', tick).rows[2]))
  expect(grounds.size).toBeGreaterThan(5)
  expect(drawDino('ko', 0).side).toContain('GAME OVER')
})


test('BB-8 rolls: the ball pattern turns', async () => {
  const balls = new Set(Array.from({ length: 8 }, (_, tick) => drawBb8('code', tick).rows[2]))
  expect(balls.size).toBeGreaterThan(2)
})

test('the K.O. crewmate gets reported', async () => {
  const sides = Array.from({ length: 30 }, (_, tick) => drawCrewmate('ko', tick).side)
  expect(sides).toContain(' REPORT')
})

const agitation = (draw: (state: any, tick: number) => unknown, state: string) => {
  let changes = 0
  let previous = ''
  for (let tick = 0; tick < 200; tick++) {
    const frame = JSON.stringify(draw(state, tick))
    if (tick && frame !== previous) changes++
    previous = frame
  }
  return changes / 2
}

test('the more the session is used, the more restless the character: calm up to 60 %, much more after', async () => {
  for (const draw of [...SPRITES, drawClawd]) {
    const [zen, good, hmm, hot] = (['zen', 'good', 'hmm', 'hot'] as const).map(state => agitation(draw, state))
    expect(good).toBeLessThanOrEqual(30)
    expect(zen).toBeLessThanOrEqual(good)
    expect(hmm).toBeGreaterThanOrEqual(good * 1.5)
    expect(hot).toBeGreaterThan(hmm)
  }
})
