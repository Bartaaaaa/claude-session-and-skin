import { test, expect, mock } from 'claude-code/testing'

const PROPS = (isWorking = false) => ({ hasSurvey: false, isWorking, maxRows: 10 }) as never

const setup = ($: any, on: any, rateLimits: unknown[], options: { now?: number; store?: Record<string, unknown> } = {}) => {
  const clock = mock.clock(on, { now: options.now ?? 0 })
  mock.store(on, options.store ?? { skin: 'smiley' })
  on('session.usage', () => ({ value: {
    startedAt: 0,
    context: { window: 200000, tokens: 34000, percent: 17 },
    rateLimits,
  } }) as never)
  on('ui.render', ($: any, e: any) => { const { Text } = $.ui.resolve(e); return h(Text, null, '') as never })
  on('command.run', () => ({ text: '' }) as never)
  return clock
}

const mount = ($: any, isWorking = false) =>
  $.ui.mount({ plugin: 'session-usage', surface: 'terminal', component: 'AbovePrompt', props: PROPS(isWorking) })

test('zen under 20 %', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 12 }])
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /12%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\(-‿-\)|\(•‿•\)/ })).toBeDefined()
  await ui.unmount()
})

test('panics from 90 %', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 91 }])
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /╯\(°[□Д]°\)╯/ })).toBeDefined()
  await ui.unmount()
})

test('flips the table from 95 %, without jitter', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 96.5 }])
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /96\.5%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^\(╯°[□Д]°\)╯ / })).toBeDefined()
  await ui.unmount()
})

test('no star at rest', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 50 }])
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /[✻✶✷✸✹✺✼✽✾✳]/ })).toBeUndefined()
  await ui.unmount()
})

test('thinks when Claude works without a tool', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30 }])
  const ui = await mount($, true)
  expect(await ui.find({ type: 'Text', text: /^\([•°-][_o][•°-]\)( \.o?O?| !)?\s*$/ })).toBeDefined()
  await ui.unmount()
})

test('7-day mini bar and details', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 50 }, { kind: 'seven_day', percentUsed: 40 }])
  const ui = await mount($)
  const cells = await ui.findAll({ type: 'Text', text: /^▰$/ })
  expect(cells.length).toBe(17)
  expect(await ui.find({ type: 'Text', text: /│ 7d/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ 40%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /7d 40%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /ctx|auj\./ })).toBeUndefined()
  await ui.unmount()
})

test('stays awake after a 20 min break', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30 }], { now: 20 * 60_000 })
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /^\([•-]‿[•-]\)/ })).toBeDefined()
  await ui.unmount()
})

test('falls asleep after 25 min without activity', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30 }], { now: 26 * 60_000 })
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /^\(-\.-\)z{0,2}Z?\s*$/ })).toBeDefined()
  await ui.unmount()
})

test('the chosen character is drawn', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30 }], { store: { skin: 'cat' } })
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /[\u{1fb00}-\u{1fb3b}]/u })).toBeDefined()
  await ui.unmount()
})

test('/usage-skin changes character and rejects an unknown one', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30 }])
  const list: any = await $.command.run({ command: 'usage-skin', args: '' } as never)
  expect(list.text).toMatch(/› smiley/)
  expect(list.text).toMatch(/  clawd/)
  const bad: any = await $.command.run({ command: 'usage-skin', args: 'dragon' } as never)
  expect(bad.text).toMatch(/Unknown/)
  await $.command.run({ command: 'usage-skin', args: 'Clawd' } as never)
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /^▝▜█████▛▘ +$/ })).toBeDefined()
  await ui.unmount()
})

test('/usage-demo plays every state then gives the bar back', async ($, on) => {
  const clock = setup($, on, [{ kind: 'five_hour', percentUsed: 12 }])
  await $.command.run({ command: 'usage-demo', args: '' } as never)
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /demo 1\/17/ })).toBeDefined()
  await ui.unmount()
  await clock.advance(4 * 3000)
  const ui2 = await mount($)
  expect(await ui2.find({ type: 'Text', text: /PANIC/ })).toBeDefined()
  await ui2.unmount()
  await clock.advance(4 * 3000)
  const ui3 = await mount($)
  expect(await ui3.find({ type: 'Text', text: /Claude is coding/ })).toBeDefined()
  await ui3.unmount()
  await clock.advance(14 * 3000)
  const ui4 = await mount($)
  expect(await ui4.find({ type: 'Text', text: /12%/ })).toBeDefined()
  await ui4.unmount()
})

test('the "Clauding…" line is hidden, with no star or word in the bar', async ($, on) => {
  const clock = setup($, on, [{ kind: 'five_hour', percentUsed: 30 }])
  const spinner = await $.ui.mount({ plugin: 'session-usage', surface: 'terminal', component: 'Spinner', props: { word: 'Clauding', message: null, suffix: '…', mode: 'thinking' } as never })
  expect(await spinner.find({ type: 'Text' })).toBeUndefined()
  await clock.settle()
  const ui = await mount($, true)
  expect(await ui.find({ type: 'Text', text: /Clauding/ })).toBeUndefined()
  await ui.unmount()
  await spinner.unmount()
})

test('never falls asleep during a turn, even a long one with no visible activity', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30 }], { now: 26 * 60_000 })
  on('turn.start', () => ({ turnId: 't' }) as never)
  await $.turn.start({} as never)
  const ui = await mount($, false)
  expect(await ui.find({ type: 'Text', text: /\(-\.-\)/ })).toBeUndefined()
  await ui.unmount()
})

test('/usage-demo run again mid-demo restarts from the beginning', async ($, on) => {
  const clock = setup($, on, [{ kind: 'five_hour', percentUsed: 12 }])
  await $.command.run({ command: 'usage-demo', args: '' } as never)
  await clock.advance(30_000)
  await $.command.run({ command: 'usage-demo', args: '' } as never)
  await clock.advance(30_000)
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /demo 11\/17/ })).toBeDefined()
  await ui.unmount()
})

test('waits for its background agents instead of falling asleep', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30 }], { now: 26 * 60_000 })
  on('agent.list', () => ({ value: [
    { id: 'a1', description: 'revue', type: 'general-purpose', status: 'running' },
    { id: 'a2', description: 'fini', type: 'general-purpose', status: 'completed' },
  ] }) as never)
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /\([•-]_[•-]\)⧗|\([•-]_[•-]\)⧖/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\(-\.-\)/ })).toBeUndefined()
  await ui.unmount()
})

test('an agent started by a subagent does not count', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30 }])
  on('agent.list', () => ({ value: [
    { id: 'a1', description: 'x', type: 'general-purpose', status: 'running', parentId: 'a0' },
  ] }) as never)
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /[⧗⧖]/ })).toBeUndefined()
  await ui.unmount()
})

test('at rest, the bar sits close to the face', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30 }])
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /^\([•-]‿[•-]\) $/ })).toBeDefined()
  await ui.unmount()
})

test('Clawd, the Claude Code mascot, on 3 lines', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30 }], { store: { skin: 'clawd' } })
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /^ ▐.{5}▌ $/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^▝▜█████▛▘ +$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ ?(▝▝   ▘▘| ▘▘ ▝▝)$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /30%/ })).toBeDefined()
  await ui.unmount()
})

test('Clawd is the default character', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30 }], { store: {} })
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /^▝▜█████▛▘ +$/ })).toBeDefined()
  await ui.unmount()
})

test('Clawd K.O. stays on its feet, groggy, with crossed-out eyes', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 100 }], { store: { skin: 'clawd' } })
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /^ ▐×███×▌ $/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^▗▟█████▙▖ +$/ })).toBeDefined()
  await ui.unmount()
})

test('K.O. at 100 %, crossed-out eyes', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 100 }])
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /^\(×_×\) +\* *$/ })).toBeDefined()
  await ui.unmount()
})

test('raises its arms when the 5h session resets', async ($, on) => {
  const clock = setup($, on, [{ kind: 'five_hour', percentUsed: 12 }])
  await $.command.run({ command: 'usage-demo', args: '' } as never)
  await clock.advance(16 * 3000)
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /^\\\(\^[‿▽]\^\)\/ [✧✦]/ })).toBeDefined()
  await ui.unmount()
})

test('none: the bar alone, no character, and the "Clauding…" line stays', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30 }])
  const set: any = await $.command.run({ command: 'usage-skin', args: 'None' } as never)
  expect(set.text).toMatch(/just the usage bar/)
  const ui = await mount($, true)
  expect(await ui.find({ type: 'Text', text: /30%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /[()▐▌\u{1fb00}-\u{1fb3b}]/u })).toBeUndefined()
  await ui.unmount()
  const spinner = await $.ui.mount({ plugin: 'session-usage', surface: 'terminal', component: 'Spinner', props: { word: 'Clauding', message: null, suffix: '…', mode: 'thinking' } as never })
  expect(await spinner.find({ type: 'Text' })).toBeDefined()
  await spinner.unmount()
})

const RESET = '1970-01-01T03:00:00.000Z'

test('time until reset, usage rate and session duration', async ($, on) => {
  const clock = setup($, on, [{ kind: 'five_hour', percentUsed: 30, resetsAt: RESET }], { now: 0 })
  on('session.measure', ($: any, e: any) => ({ changed: e.changed }) as never)
  await $.session.measure({ context: { window: 200000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 30, resetsAt: RESET }], changed: ['rateLimits'] } as never)
  await clock.advance(68 * 60_000)
  await $.session.measure({ context: { window: 200000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 47, resetsAt: RESET }], changed: ['rateLimits'] } as never)
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /↻ 1h52 · \+15%\/h · sess 1h08/ })).toBeDefined()
  await ui.unmount()
})

test('each item can be turned off in the config', async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30, resetsAt: RESET }], { now: 60 * 60_000 })
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /↻ 2h00 · sess 1h00/ })).toBeDefined()
  await ui.unmount()
})

test('with every item off, nothing after the week', { options: { showResetIn: false, showRate: false, showSessionTime: false } }, async ($, on) => {
  setup($, on, [{ kind: 'five_hour', percentUsed: 30, resetsAt: RESET }], { now: 60 * 60_000 })
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /↻ \d+[hm]|sess|%\/h/ })).toBeUndefined()
  await ui.unmount()
})
