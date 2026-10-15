import { test, expect, mock } from 'claude-code/testing'

import { countdown, tokens, tone } from './register'

const NOW = Date.parse('2026-10-15T08:00:00Z')

const PROPS = { isDraft: false, isWorking: false, hint: '? for shortcuts' }

test('formatters', async () => {
  expect(tokens(59_300)).toBe('59.3k')
  expect(tokens(1_000_000)).toBe('1M')
  expect(countdown(72 * 60_000)).toBe('1h12m')
  expect(countdown((3 * 24 + 4) * 3600_000)).toBe('3d4h')
  expect(tone(34)).toBe('success')
  expect(tone(85)).toBe('error')
})

test('band shows context, 5h and 1w', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.usage', () => ({ value: {
    startedAt: NOW,
    context: { tokens: 59_300, window: 1_000_000, percent: 6 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 34, resetsAt: new Date(NOW + 72 * 60_000).toISOString() },
      { kind: 'seven_day', percentUsed: 87.5, resetsAt: new Date(NOW + 76 * 3600_000).toISOString() },
    ],
    cost: { usd: 1.234 },
  } }))

  // the engine's own hint line beneath the plugin
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text dimColor>{e.props.hint}</Text>
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    for (const columns of [140, 60]) {
      const ui = await $.ui.mount({
        plugin: 'usage-hud',
        surface,
        component: 'PromptHint',
        props: PROPS,
        viewport: { columns, rows: 40 },
      })
      expect(await ui.find({ type: 'Text', text: /\? for shortcuts/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /59\.3k\/1M/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /34%/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /88%/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /↻ 1h12m/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /↻ 3d4h/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /\$/ })).toBeUndefined()
      await ui.unmount()
    }
  }
})
