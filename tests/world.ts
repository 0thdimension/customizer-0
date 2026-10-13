// What sits beneath Customizer 0 in a test: the machine (its store, environment, clock and files) and the
// engine's own answers at the events the plugin passes on.
import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'

export const COMPOSER = { kind: 'composer' } as const
export const PRESENTATION = { isFullscreen: false, columns: 100 }

export type World = {
  statuses: (string | undefined)[] // every status line the plugin set
  registered: string[] // slash commands the plugin registered
  clock: ReturnType<typeof mock.clock>
}

export function world(on: On, options: { settings?: unknown; store?: Record<string, unknown>; env?: Record<string, string> } = {}): World {
  const w: World = { statuses: [], registered: [], clock: mock.clock(on) }
  mock.store(on, { ...(options.settings === undefined ? {} : { settings: options.settings }), ...options.store })
  mock.env(on, { CLAUDE_CODE_ENTRYPOINT: 'cli', ...options.env })
  on('session.id', () => ({ value: 'conv-1' }))
  on('command.register', ($, e) => {
    w.registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.status', ($, e) => {
    w.statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))
  // The engine's own band above the prompt is empty unless a survey is up.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.context', ($, e) => ({ blocks: e.blocks }))
  on('prompt.submit', ($, e) => ({ text: e.text, context: e.context }))
  on('classic.Stop', () => ({}))
  on('classic.SessionStart', () => ({}))
  on('tool.call', () => ({ result: 'ok' }))
  return w
}
