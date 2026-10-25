import { test, expect } from 'claude-code/testing'
import { drawClawd } from '../hooks/clawd'
import { TALL_MOODS as CLAWD_MOODS } from '../hooks/tall'
import { MOODS } from '../hooks/look'

const OPEN = ' ▐▛███▜▌ '
const CLOSED = ' ▐█████▌ '

test('Clawd has a state for every mood', async () => {
  expect(CLAWD_MOODS.length).toBe(MOODS.length)
})

test('Clawd blinks fast: one frame with eyes shut, then open again', async () => {
  for (const state of ['zen', 'good'] as const) {
    const eyes = Array.from({ length: 200 }, (_, tick) => drawClawd(state, tick).rows[0])
    const closed = eyes.filter(e => e === CLOSED).length
    expect(closed).toBeGreaterThan(0)
    expect(closed).toBeLessThan(eyes.length / 10)
    eyes.forEach((e, i) => { if (e === CLOSED) expect(eyes[i + 1]).not.toBe(CLOSED) })
  }
})

test('Clawd sleeps with eyes shut, K.O. with crossed-out eyes', async () => {
  expect(drawClawd('sleep', 0).rows[0]).toBe(CLOSED)
  expect(drawClawd('sleep', 26).rows[0]).toBe(CLOSED)
  expect(drawClawd('ko', 26).rows[0]).toBe(' ▐×███×▌ ')
})

test('Clawd panics waving its arms', async () => {
  const bodies = new Set(Array.from({ length: 8 }, (_, tick) => drawClawd('panic', tick).rows[1]))
  expect(bodies).toContain(' ▜█████▛ ')
  expect(bodies).toContain('▝▜█████▛▘')
})

test('Clawd types code one claw after the other, the bubble next to its head', async () => {
  const bodies = new Set(Array.from({ length: 40 }, (_, tick) => drawClawd('code', tick).rows[1]))
  expect(bodies).toContain('▗▟█████▛▘')
  expect(bodies).toContain('▝▜█████▙▖')
  const sides = new Set(Array.from({ length: 200 }, (_, tick) => drawClawd('think', tick).side))
  expect(sides).toContain(' .oO')
  expect(sides).toContain(' !')
})

test('Clawd dances when the session resets', async () => {
  expect(drawClawd('refresh', 0).rows).toEqual(['▐▐▄███▄▌▌', ' ▜█████▛ ', ' ▝▝   ▘▘'])
  expect(drawClawd('refresh', 3).rows[2]).toBe('  ▘▘ ▝▝')
})

test('Clawd K.O. stays on its feet, groggy, claws dangling, stars next to its head', async () => {
  const ko = drawClawd('ko', 0)
  expect(ko.rows).toEqual([' ▐×███×▌ ', '▗▟█████▙▖', ' ▝▝   ▘▘'])
  expect(ko.sideRow).toBe(0)
  expect(drawClawd('ko', 4).side).not.toBe(ko.side)
})

test('Clawd always keeps its legs: 3 full lines in every state', async () => {
  for (const state of [...CLAWD_MOODS, 'sleep', 'hurt', 'refresh', 'think', 'code', 'read', 'shell', 'web', 'agent', 'wait'] as const) {
    for (let tick = 0; tick < 60; tick++) {
      for (const row of drawClawd(state, tick).rows) expect(row.trim().length).toBeGreaterThan(0)
    }
  }
})

test('Clawd really moves in every mood: several poses within 3 s', async () => {
  for (const state of CLAWD_MOODS) {
    const poses = new Set(Array.from({ length: 20 }, (_, tick) => JSON.stringify(drawClawd(state, tick))))
    expect(poses.size).toBeGreaterThan(2)
  }
})

test('at rest, Clawd stays calm: mostly still, no walking', async () => {
  for (const state of ['zen'] as const) {
    const frames = Array.from({ length: 300 }, (_, tick) => drawClawd(state, tick))
    expect(frames.every(f => f.rows[2] === ' ▝▝   ▘▘')).toBe(true)
    const changes = frames.filter((f, i) => i > 0 && JSON.stringify(f) !== JSON.stringify(frames[i - 1])).length
    expect(changes).toBeLessThan(frames.length / 6)
  }
})

test('at rest, Clawd shows no "?" that could be mistaken for a question', async () => {
  for (const state of ['zen', 'good', 'hmm'] as const) {
    for (let tick = 0; tick < 100; tick++) expect(drawClawd(state, tick).side).not.toContain('?')
  }
})

test('Clawd raises its arms to throw the table, and keeps them up while throwing', async () => {
  for (let tick = 0; tick < 40; tick++) {
    const { rows, side } = drawClawd('flip', tick)
    if (side.includes('┻')) {
      expect(rows[0]).toMatch(/^▐.*▌▌$/)
      expect(rows[1]).toBe(' ▜█████▛ ')
    }
  }
})
