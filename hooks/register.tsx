// Customizer 0's hooks module. Claude Code loads it in its own environment; nothing runs through node.
// Every call on $ lives in this file (the engine reads them from here); the files it imports are pure.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Settings } from '../types'
import { type BarActions, barTree } from './bar'
import { editedFile, isClarifyingQuestion, missingChecks } from './checks'
import { HELP, HINT, NEXT_MESSAGE, parseMod } from './command'
import { compactLine, fullBlock, offNotice, preview, statusLine, statusText, stopReason } from './rules'
import { type Patch, applyPatch, behaviorKey, defaults, normalize } from './settings'

// What the module holds for the session in $.state (declared in ../types). It survives a hot reload.
const SETTINGS = atom({ plugin: 'customizer-0', key: 'settings' } as const, null as Settings | null)
const DELIVERED = atom({ plugin: 'customizer-0', key: 'delivered' } as const, null as string | null)
const EDITS = atom({ plugin: 'customizer-0', key: 'edits' } as const, [] as string[])
const RESET_ARMED = atom({ plugin: 'customizer-0', key: 'resetArmed' } as const, false)
const BAR_OPEN = atom({ plugin: 'customizer-0', key: 'barOpen' } as const, false)

const BLOCK = 'customizer-0' // the name of the context block that carries the rules
const KEPT_CONVERSATIONS = 200 // how many conversations' last rules are remembered for a resume

// Scripted runs (claude -p, Agent SDK programs, CI) usually parse Claude's output, so Customizer 0 stays out
// of them unless the user includes them with /mod scripted on.
const SCRIPTED = /^(sdk-|mcp$|claude-code-github-action$)/
let entrypoint: string | undefined | null = null // read once per load
let shownStatus: string | undefined | null = null // the status line last set; null before the first

async function isScripted($: EngineInterface, s: Settings): Promise<boolean> {
  if (s.headless) return false
  if (entrypoint === null) {
    try {
      entrypoint = await $.env.get('CLAUDE_CODE_ENTRYPOINT')
    } catch {
      entrypoint = undefined
    }
  }
  return SCRIPTED.test(entrypoint ?? '')
}

function debug($: EngineInterface, what: string, err: unknown): void {
  try {
    $.ui.log(`customizer-0: ${what}: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' })
  } catch {
    // nowhere to log
  }
}

// The quiet line under the prompt that says what the mod is doing; set only when it changes.
function showStatus($: EngineInterface, s: Settings): void {
  const text = statusLine(s)
  if (text === shownStatus) return
  try {
    $.ui.status(text)
    shownStatus = text
  } catch (err) {
    debug($, 'could not set the status line', err)
  }
}

/* ------------------------------------------------------------------ settings in $.store */

// The settings as stored, or the defaults before anything has been changed.
async function loadSettings($: EngineInterface): Promise<Settings> {
  return normalize(await $.store.get('settings'))
}

// Stores the settings, redraws the controls with them, and updates the status line.
async function saveSettings($: EngineInterface, settings: Settings): Promise<Settings> {
  const clean = normalize(settings)
  await $.store.set('settings', clean)
  await update($, SETTINGS, () => clean)
  showStatus($, clean)
  return clean
}

async function changeSettings($: EngineInterface, patch: Patch): Promise<Settings> {
  return saveSettings($, applyPatch(await loadSettings($), patch))
}

// Each press reads the stored settings afresh, so two quick presses never undo each other.
async function change($: EngineInterface, edit: (s: Settings) => Settings): Promise<void> {
  await saveSettings($, edit(await loadSettings($)))
}

// Brings this session's copy up to date with the store, which another chat may have changed. Writes only on
// a difference, since every write redraws the controls.
async function refreshState($: EngineInterface): Promise<Settings> {
  const stored = await loadSettings($)
  const shown = await read($, SETTINGS)
  if (!shown || JSON.stringify(shown) !== JSON.stringify(stored)) await update($, SETTINGS, () => stored)
  showStatus($, stored)
  return stored
}

/* ------------------------------------------------------------------ the rules Claude has */

const asRecord = (v: unknown): Record<string, string> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Record<string, string>) } : {}

// Records which rules Claude now has: for this session in $.state, and per conversation in $.store so a
// resumed conversation knows what it had.
async function setDelivered($: EngineInterface, key: string | null): Promise<void> {
  await update($, DELIVERED, () => key)
  if (key === null || key === 'pending') return
  try {
    const id = await $.session.id()
    const kept = asRecord(await $.store.get('conversations'))
    if (kept[id] === key) return
    delete kept[id]
    kept[id] = key
    const ids = Object.keys(kept)
    for (const old of ids.slice(0, Math.max(0, ids.length - KEPT_CONVERSATIONS))) delete kept[old]
    await $.store.set('conversations', kept)
  } catch (err) {
    debug($, 'could not remember the delivered rules', err)
  }
}

// The note a prompt carries for Claude, or null.
async function noteFor($: EngineInterface, s: Settings): Promise<string | null> {
  const prev = await read($, DELIVERED)
  const key = behaviorKey(s)
  if (prev === null) {
    // The conversation's first prompt: prompt.context gives its first message the full rules.
    await setDelivered($, 'pending')
    return null
  }
  let note: string | null
  if (prev === 'pending') note = fullBlock(s) // prompt.context never ran for this conversation
  else if (!s.enabled) note = prev === 'off' ? null : offNotice()
  else if (prev !== key) note = fullBlock(s, { changed: prev !== 'off' })
  else note = compactLine(s)
  await setDelivered($, key)
  return note
}

/* ------------------------------------------------------------------ /mod and the controls bar */

async function setBar($: EngineInterface, open: boolean): Promise<string> {
  if (open) await refreshState($)
  await update($, BAR_OPEN, () => open)
  return open ? "Customizer 0's controls are above the chat box." : "Closed Customizer 0's controls."
}

async function runMod($: EngineInterface, args: string): Promise<{ text: string }> {
  const action = parseMod(args)
  switch (action.kind) {
    case 'toggle':
      return { text: await setBar($, !(await read($, BAR_OPEN))) }
    case 'open':
      return { text: await setBar($, true) }
    case 'close':
      return { text: await setBar($, false) }
    case 'status':
      return { text: statusText(await loadSettings($)) }
    case 'preview':
      return { text: preview(await loadSettings($)) }
    case 'help':
      return { text: HELP }
    case 'reset':
      await saveSettings($, defaults())
      return { text: `Customizer 0 is back to its defaults: every setting is off. ${NEXT_MESSAGE}` }
    case 'change':
      await changeSettings($, action.patch)
      return { text: `${action.said.join(' ')} ${NEXT_MESSAGE}` }
    case 'error':
      return { text: `${action.message} ${HINT}` }
  }
}

// Reset needs two presses, the second within four seconds.
async function pressReset($: EngineInterface): Promise<void> {
  if (await read($, RESET_ARMED)) {
    await update($, RESET_ARMED, () => false)
    await saveSettings($, defaults())
    return
  }
  await update($, RESET_ARMED, () => true)
  try {
    $.clock.after(4000, () => void update($, RESET_ARMED, () => false))
  } catch {
    // without a timer the button stays armed until the next press
  }
}

function barActions($: EngineInterface): BarActions {
  return {
    choose: (key, value) => change($, (s) => applyPatch(s, value === 'off' ? { [key]: { on: false } } : { [key]: { value } })),
    flip: (key) => change($, (s) => applyPatch(s, { [key]: { on: !s[key].on } })),
    toggleMaster: () => change($, (s) => applyPatch(s, { enabled: !s.enabled })),
    close: async () => {
      await update($, BAR_OPEN, () => false)
    },
    pressReset: () => pressReset($),
  }
}

async function storedSettings($: EngineInterface): Promise<Settings> {
  try {
    return normalize(await $.store.get('settings'))
  } catch {
    return defaults()
  }
}

// While the controls are open, keeps them in step with changes made in other chats.
async function syncBar($: EngineInterface): Promise<void> {
  try {
    if (await read($, BAR_OPEN)) await refreshState($)
  } catch (err) {
    debug($, 'sync failed', err)
  }
}

/* ------------------------------------------------------------------ the hooks */

export const register: Register = (on) => {
  // Once per load: /mod for terminals, this session's copy of the settings and its status line, and the
  // sync with other chats.
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'mod',
        description: 'Show or hide the Customizer 0 controls, or change a setting: /mod creativity 8, /mod recheck on, /mod help',
        argumentHint: '[setting value]',
        immediate: true,
      })
    } catch (err) {
      debug($, 'could not register /mod', err)
    }
    try {
      await refreshState($)
    } catch (err) {
      debug($, 'could not read the settings', err)
    }
    try {
      $.clock.every(2000, () => void syncBar($))
    } catch (err) {
      debug($, 'could not start the sync', err)
    }
    return next(e)
  })

  // /mod is registered above for terminals; the skill in skills/mod lists it as /customizer-0:mod in the
  // desktop app's menu, which only knows the commands a session starts with. Either way the module answers.
  on('command.run', { command: ['mod', 'customizer-0:mod'] }, ($, e) => runMod($, e.args)).catch(() => ({
    text: 'Customizer 0 could not run /mod just now. Try again, or type /mod help.',
  }))

  // The controls sit in the band above the prompt while they're open, and step aside for a survey.
  // Reading $.state while drawing subscribes the band: any later write of the settings redraws it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, BAR_OPEN))) return next(e)
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e) // the only surfaces that draw the band
    const s = normalize((await read($, SETTINGS)) ?? (await storedSettings($)))
    const armed = await read($, RESET_ARMED)
    const { Box, Text, Button, Select } = $.ui.resolve(e)
    return barTree({ Box, Text, Button, Select }, s, armed, barActions($))
  })

  // A conversation's first message carries the full rules. Compaction and /clear compute it again, so the
  // rules sit in the cached start of the conversation and come back after a compaction.
  on('prompt.context', async ($, e, next) => {
    const result = await next(e)
    const s = await loadSettings($)
    if (await isScripted($, s)) return result
    await setDelivered($, behaviorKey(s))
    const block = fullBlock(s)
    if (!block) return result
    return { ...result, blocks: [...result.blocks.filter((b) => b.name !== BLOCK), { name: BLOCK, text: block }] }
  })

  // Each prompt carries a note only Claude reads: the one-line reminder, the new rules after a change, or a
  // single notice after switching off. It rides after the prompt, so the cached conversation never changes.
  on('prompt.submit', async ($, e, next) => {
    if (e.turnId === undefined) await update($, EDITS, () => []) // this prompt starts a new turn
    const s = await loadSettings($)
    showStatus($, s)
    if (await isScripted($, s)) return next(e)
    const note = await noteFor($, s)
    return next(note ? { ...e, context: [...(e.context ?? []), note] } : e)
  })

  // A /clear starts a new conversation, which prompt.context gives the rules. A resumed conversation gets them
  // from prompt.context too, since Claude Code attaches the start-of-chat context again, and failing that
  // from its next prompt. If the mod was switched off since the conversation last had rules, the resume
  // carries the off notice.
  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    if (e.source === 'clear') {
      await update($, DELIVERED, () => null)
      await update($, EDITS, () => [])
      return result
    }
    if (e.source !== 'resume') return result
    const s = await loadSettings($)
    if (await isScripted($, s)) return result
    if (s.enabled) {
      await update($, DELIVERED, (current) => current ?? 'pending')
      return result
    }
    let had: string | undefined
    try {
      had = asRecord(await $.store.get('conversations'))[e.session_id]
    } catch {
      had = undefined
    }
    await setDelivered($, 'off')
    return had && had !== 'off' ? { ...result, additionalContext: [...(result.additionalContext ?? []), offNotice()] } : result
  })

  // Remembers the files Claude's file tools changed this turn, in the main conversation (not a subagent's).
  on('tool.call', { tool: /^(Edit|Write|MultiEdit|NotebookEdit)$/ }, async ($, e, next) => {
    const ran = await next(e)
    const file = editedFile(e)
    if (file && e.agentId === undefined && ran.deny === undefined && ran.isError !== true) {
      await update($, EDITS, (list) => (list.includes(file) ? list : [...list, file]))
    }
    return ran
  })

  // Every reply ends with the finish checks the user turned on. When one is missing from Claude's last
  // message, send it back once with the specific fix-ups, naming the files it changed this turn.
  // stop_hook_active means it is already on that second try.
  on('classic.Stop', async ($, e, next) => {
    const result = await next(e)
    if (result.block !== undefined || e.stop_hook_active) return result
    const s = await loadSettings($)
    if (!s.enabled || (await isScripted($, s))) return result
    const text = e.last_assistant_message ?? ''
    if (isClarifyingQuestion(text)) return result
    const missing = missingChecks(s, text)
    return missing.length ? { ...result, block: stopReason(missing, await read($, EDITS)) } : result
  })
}
