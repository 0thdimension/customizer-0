// The words of the /mod command: what it accepts and what it says. register.tsx runs it.
import { CREATIVITY, EXPERTISE_IDS, expertiseById } from './catalog'
import type { Patch } from './settings'

export const HELP = `Customizer 0: a control panel for Claude Code
In the desktop app the command is /customizer-0:mod; in a terminal it is also /mod.

  /mod                        Show or hide the controls above the chat box
  /mod status                 Show the current settings
  /mod creativity 0-10        How much creative freedom Claude takes
  /mod questions 0-20         Questions to ask at the start of new tasks (or: /mod 5 questions)
  /mod expertise LEVEL        vibe | novice | intermediate | expert
  /mod FEATURE on|off         creativity, questions, expertise, recheck response,
                              possible issues, possible safety issues, or checks (all three)
  /mod on | /mod off          The whole mod
  /mod scripted on|off        Include scripted runs (claude -p, Agent SDK programs)
  /mod reset                  Restore the defaults
  /mod preview                Show exactly what Claude receives`

export const NEXT_MESSAGE = 'Claude gets the new settings with your next message.'
export const HINT = 'Type /mod help for the list.'

export type ModAction =
  | { kind: 'toggle' | 'open' | 'close' | 'status' | 'preview' | 'help' | 'reset' }
  | { kind: 'change'; patch: Patch; said: string[] }
  | { kind: 'error'; message: string }

type Feature = 'creativity' | 'questions' | 'expertise' | 'recheck' | 'painPoints' | 'safety' | 'checks' | 'scripted'

const FEATURES: Record<string, Feature> = {
  creativity: 'creativity',
  creative: 'creativity',
  questions: 'questions',
  question: 'questions',
  qs: 'questions',
  expertise: 'expertise',
  audience: 'expertise',
  recheck: 'recheck',
  check: 'recheck',
  painpoints: 'painPoints',
  pain: 'painPoints',
  issues: 'painPoints',
  safety: 'safety',
  checks: 'checks',
  scripted: 'scripted',
  headless: 'scripted',
}

const ACTIONS: Record<string, 'open' | 'close' | 'status' | 'preview' | 'help' | 'reset'> = {
  open: 'open',
  show: 'open',
  close: 'close',
  hide: 'close',
  status: 'status',
  preview: 'preview',
  help: 'help',
  reset: 'reset',
}

const LABELS: Record<Exclude<Feature, 'scripted'>, string> = {
  creativity: 'Creativity',
  questions: 'Questions to ask',
  expertise: 'Coding expertise',
  recheck: 'Recheck response',
  painPoints: 'Possible issues',
  safety: 'Possible safety issues',
  checks: 'All three finish checks',
}

const FILLER = new Set(['set', 'to', 'the', 'at', 'please', 'level', 'be', 'now', 'turn', 'switch', 'and'])

// Folds the multi-word names the controls use into single words, then splits.
function tokenize(args: string): string[] {
  const text = ` ${args.toLowerCase()} `
    .replace(/possible safety issues?/g, 'safety')
    .replace(/possible issues?/g, 'painpoints')
    .replace(/recheck response/g, 'recheck')
    .replace(/questions? to ask/g, 'questions')
    .replace(/pain[\s-]+points?/g, 'painpoints')
    .replace(/safety issues?/g, 'safety')
    .replace(/recheck code/g, 'recheck')
    .replace(/clarifying questions?/g, 'questions')
    .replace(/coding expertise/g, 'expertise')
    .replace(/scripted runs?/g, 'scripted')
    .replace(/\b(vibe|novice|intermediate|expert)\s+coders?\b/g, '$1')
    .replace(/[,;:=!?]/g, ' ')
  return text.split(/\s+/).filter((t) => t && !FILLER.has(t))
}

const whole = (t: string | undefined) => (t !== undefined && /^\d+$/.test(t) ? Number(t) : undefined)

function toggle(f: Feature, on: boolean): { patch: Patch; said: string } {
  if (f === 'scripted') return { patch: { headless: on }, said: `Scripted runs (claude -p, Agent SDK): ${on ? 'included' : 'left alone'}.` }
  if (f === 'checks') return { patch: { recheck: { on }, painPoints: { on }, safety: { on } }, said: `${LABELS.checks}: ${on ? 'on' : 'off'}.` }
  return { patch: { [f]: { on } }, said: `${LABELS[f]}: ${on ? 'on' : 'off'}.` }
}

function setCreativity(n: number | undefined) {
  if (n === undefined || n > 10) return { error: 'Creativity takes a whole number from 0 to 10.' }
  return { patch: { creativity: { value: n } }, said: `Creativity: ${n}/10, ${CREATIVITY[n]!.name}.` }
}

function setQuestions(n: number | undefined) {
  if (n === undefined || n > 20) return { error: 'Questions takes a whole number from 0 to 20.' }
  return { patch: { questions: { value: n } }, said: n === 0 ? 'Questions to ask: none.' : `Questions to ask: ${n}.` }
}

function setExpertise(id: string | undefined) {
  if (!id || !EXPERTISE_IDS.includes(id as never)) return { error: `Expertise is one of: ${EXPERTISE_IDS.join(', ')}.` }
  return { patch: { expertise: { value: id } }, said: `Coding expertise: ${expertiseById(id).label}.` }
}

const isSwitch = (t: string | undefined) => t === 'on' || t === 'off'

// Reads what followed /mod. Several changes can share one line: /mod creativity 8 recheck on.
export function parseMod(args: string): ModAction {
  const tokens = tokenize(args)
  if (tokens.length === 0) return { kind: 'toggle' }
  const only = tokens.length === 1 ? ACTIONS[tokens[0]!] : undefined
  if (only) return { kind: only }

  const patches: Patch[] = []
  const said: string[] = []
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]!
    const next = tokens[i + 1]
    let step: { patch: Patch; said: string } | { error: string }
    if (isSwitch(t) && next !== undefined && FEATURES[next]) {
      step = toggle(FEATURES[next]!, t === 'on') // on recheck
      i += 2
    } else if (isSwitch(t) && next === undefined && patches.length === 0) {
      step = { patch: { enabled: t === 'on' }, said: `Customizer 0 is ${t}.` } // /mod off
      i += 1
    } else if (whole(t) !== undefined && next !== undefined && (FEATURES[next] === 'questions' || FEATURES[next] === 'creativity')) {
      step = FEATURES[next] === 'questions' ? setQuestions(whole(t)) : setCreativity(whole(t)) // 5 questions
      i += 2
    } else if (FEATURES[t]) {
      const f = FEATURES[t]!
      if (isSwitch(next)) step = toggle(f, next === 'on') // recheck on
      else if (f === 'creativity') step = setCreativity(whole(next))
      else if (f === 'questions') step = setQuestions(whole(next))
      else if (f === 'expertise') step = setExpertise(next)
      else step = { error: `Say on or off after "${t}".` }
      i += 2
    } else if (EXPERTISE_IDS.includes(t as never)) {
      step = setExpertise(t) // /mod vibe
      i += 1
    } else {
      step = { error: `"${t}" isn't something /mod knows.` }
      i += 1
    }
    if ('error' in step) return { kind: 'error', message: step.error }
    patches.push(step.patch)
    said.push(step.said)
  }
  return { kind: 'change', patch: Object.assign({}, ...patches) as Patch, said }
}
