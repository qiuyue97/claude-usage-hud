export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Snapshot = {
  context: { tokens?: number; window: number; percent?: number }
  limits: Limit[]
}

declare module 'claude-code' {
  interface PluginState {
    'usage-hud': { snapshot: Snapshot | null; now: number }
  }
}
