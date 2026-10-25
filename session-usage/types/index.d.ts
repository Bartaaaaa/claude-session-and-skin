/** What Claude is doing while it works. */
export type Activity = 'think' | 'code' | 'read' | 'shell' | 'web' | 'agent' | 'wait'

export type Usage = {
  session: number | null
  resetsAt: string | null
  week: number | null
  weekResetsAt: string | null
}

/** A reading of the 5h window %, used to estimate the usage rate. */
export type Sample = { t: number; p: number; resetsAt: string | null }

/** The weekly % read day by day over the current 7-day window, kept across sessions. */
export type WeekTrack = {
  resetsAt: number
  /** First reading: usage on the days before it is unknown. */
  start: { day: number; p: number }
  /** Highest % read on each day of the window (0 to 6). */
  max: Record<string, number>
}

declare module 'claude-code' {
  interface PluginState {
    'session-usage': {
      usage: Usage | null
      frame: number
      lastActive: number
      errorAt: number | null
      refreshedAt: number | null
      samples: Sample[]
      demoStartedAt: number | null
      activity: Activity | null
      inTurn: boolean
      startedAt: number | null
    }
  }
}
