// Customizer 0's contract: the settings it keeps and the values its hooks module holds in $.state.

export type ExpertiseId = 'vibe' | 'novice' | 'intermediate' | 'expert'

export type Switch = { on: boolean }

export type Settings = {
  version: 3
  enabled: boolean
  creativity: { on: boolean; value: number }
  questions: { on: boolean; value: number }
  expertise: { on: boolean; value: ExpertiseId }
  painPoints: Switch
  safety: Switch
  recheck: Switch
  headless: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'customizer-0': {
      // The settings the controls draw, mirrored from $.store; null until something has read the store.
      settings: Settings | null
      // The rules Claude last received in this conversation: a behavior key, 'off', 'pending', or null.
      delivered: string | null
      // Files Claude's file tools changed since the prompt that started the turn.
      edits: string[]
      // The Reset button was pressed once and waits for a second press.
      resetArmed: boolean
      // Whether the controls bar above the prompt is showing.
      barOpen: boolean
    }
  }
}
