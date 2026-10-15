import { atom, read, update } from 'claude-code'
import type { Register, SessionUsage, SessionMeasureInput } from 'claude-code'

import type { Limit, Snapshot } from '../types'

const snapshot = atom({ plugin: 'usage-hud', key: 'snapshot' } as const, null)
const now = atom({ plugin: 'usage-hud', key: 'now' } as const, 0)

const WINDOW_MS: Record<string, number> = {
  five_hour: 5 * 3600_000,
  seven_day: 7 * 86400_000,
}

const LABEL: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
  spend_limit: '$',
}

const toSnapshot = (u: SessionUsage | SessionMeasureInput): Snapshot => ({
  context: {
    tokens: u.context.tokens,
    window: u.context.window,
    percent: u.context.percent,
  },
  limits: u.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })),
})

export const tone = (pct: number) => (pct < 50 ? 'success' : pct < 80 ? 'warning' : 'error')

export const tokens = (n: number) =>
  n >= 1_000_000
    ? `${+(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${+(n / 1000).toFixed(1)}k`
      : `${n}`

export const countdown = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60_000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  const mm = m % 60

  if (d > 0) return `${d}d${h}h`
  if (h > 0) return `${h}h${String(mm).padStart(2, '0')}m`

  return `${mm}m`
}

/** Fraction of the window already elapsed, or undefined when unknown. */
const pace = (limit: Limit, at: number) => {
  const span = WINDOW_MS[limit.kind]
  if (!span || !limit.resetsAt || !at) return undefined
  const left = Date.parse(limit.resetsAt) - at

  return Math.min(1, Math.max(0, 1 - left / span))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    await update($, snapshot, () => toSnapshot(usage))
    const at = await $.clock.now()
    await update($, now, () => at)
    // keep reset countdowns fresh between turns
    $.clock.every(60_000, async () => {
      const t = await $.clock.now()
      await update($, now, () => t)
    })

    return result
  })

  on('session.measure', async ($, e, next) => {
    await update($, snapshot, () => toSnapshot(e))
    const at = await $.clock.now()
    await update($, now, () => at)

    return next(e)
  })

  // drawn under the prompt: the engine's hint line, then the HUD beneath it
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const hint = await next(e)

    // drawing is pure: before the first measurement, read the figures directly
    const snap = (await read($, snapshot)) ?? toSnapshot(await $.session.usage())
    let at = await read($, now)
    if (!at) at = await $.clock.now()

    const { Box, Text } = $.ui.resolve(e)
    const isWide = (e.viewport?.columns ?? 80) >= 100
    const width = isWide ? 12 : 10

    const bar = (pct: number) => {
      const p = Math.min(100, Math.max(0, pct))
      // at least one filled cell once anything is used, so 1–8% still shows
      const filled = p === 0 ? 0 : Math.max(1, Math.round((p / 100) * width))

      return (
        <Text>
          <Text color={tone(pct)}>{'▰'.repeat(filled)}</Text>
          <Text color="inactive" dimColor>
            {'▱'.repeat(width - filled)}
          </Text>
        </Text>
      )
    }

    const metric = (key: string, label: string, pct: number | undefined, tail: string, elapsed?: number) => (
      <Box key={key} flexDirection="row" gap={1}>
        <Text color="claude" weight="bold">
          {label.padEnd(3)}
        </Text>
        {pct === undefined ? (
          <Text color="inactive" dimColor>
            {'▱'.repeat(width)}
          </Text>
        ) : (
          bar(pct)
        )}
        <Text color={pct === undefined ? 'inactive' : tone(pct)} weight="bold">
          {pct === undefined ? '  –' : `${String(Math.round(pct)).padStart(3)}%`}
        </Text>
        {tail ? <Text dimColor>{tail}</Text> : null}
        {/* used faster than the window's time is passing */}
        {pct !== undefined && elapsed !== undefined && pct > elapsed * 100 + 5 ? (
          <Text color="warning">▲ fast</Text>
        ) : null}
      </Box>
    )

    const ctx = snap.context
    const ctxTail = ctx.tokens === undefined ? `of ${tokens(ctx.window)}` : `${tokens(ctx.tokens)}/${tokens(ctx.window)}`
    const rows = []

    for (const kind of ['five_hour', 'seven_day']) {
      const limit = snap.limits.find(l => l.kind === kind)
      const reset = limit?.resetsAt ? `↻ ${countdown(Date.parse(limit.resetsAt) - at)}` : ''
      rows.push(metric(kind, LABEL[kind] ?? kind, limit?.percentUsed, reset, limit && pace(limit, at)))
    }

    for (const limit of snap.limits.filter(l => !WINDOW_MS[l.kind])) {
      rows.push(metric(limit.kind, LABEL[limit.kind] ?? limit.kind, limit.percentUsed, ''))
    }

    rows.push(metric('context', 'context', ctx.percent, ctxTail))

    return (
      <Box flexDirection="column">
        {hint}
        <Box flexDirection={isWide ? 'row' : 'column'} columnGap={3}>
          {rows}
        </Box>
      </Box>
    )
  })
}
