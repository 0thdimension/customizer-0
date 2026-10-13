// Turns the user's settings into the text Claude receives. Every word comes from fixed templates here and
// in catalog.ts; nothing typed into a setting is ever passed through to Claude.
import type { Settings } from '../types'
import { CREATIVITY, MARK, expertiseById } from './catalog'
import type { CheckId } from './checks'
import { normalize } from './settings'

const code = (s: string) => `\`${s}\``
const basename = (file: string) => file.split(/[\\/]/).pop() || file

export function joinList(items: readonly string[], last = 'and'): string {
  if (items.length < 2) return items.join('')
  if (items.length === 2) return `${items[0]} ${last} ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, ${last} ${items[items.length - 1]}`
}

function questionRule(n: number): string {
  if (n === 0) return "Questions to ask: don't ask any. Make sensible assumptions, state them briefly, and proceed."
  const count = n === 1 ? 'one clarifying question' : `${n} clarifying questions`
  const how =
    n <= 4
      ? 'Use the AskUserQuestion tool if you have it, so you can carry on in the same turn.'
      : 'Use the AskUserQuestion tool if you have it, so you can carry on in the same turn; it takes up to 4 questions per call, so ask in batches.'
  return `Questions to ask: at the start of every new request or question from the user, whatever its kind (a question, research, writing, a plan, or code), ask the user ${count} before you begin. ${how} Ask about what would most change the result, and offer likely answers. Skip this only when the user's message answers questions you just asked.`
}

function finishRules(s: Settings): string[] {
  const out: string[] = []
  if (s.recheck.on) {
    out.push(
      `Recheck response: re-read your reply and any files you changed, check that it answers what was asked, that its facts and claims hold up (verify what you can), and that any code or steps work, and fix what you find. Then write a line on its own like ${code(`${MARK} recheck ✓ · facts checked, 1 fix`)}.`,
    )
  }
  if (s.painPoints.on) {
    out.push(
      'Possible issues: end the reply with a short section titled "Possible issues": the ways what you said or built could go wrong for the user, or where they could get confused or stuck, each with a suggested fix. Two to five points for a full answer; one line is enough for a short reply.',
    )
  }
  if (s.safety.on) {
    out.push(
      'Possible safety issues: end the reply with a short section titled "Possible safety issues": security, privacy, data-loss, legal, or misuse risks in what you said or built, each with a fix. If you found none, say in a line what you checked.',
    )
  }
  return out
}

export function rules(settings: Settings): string[] {
  const s = normalize(settings)
  const out: string[] = []
  if (s.creativity.on) {
    const level = CREATIVITY[s.creativity.value]!
    out.push(`Creativity ${s.creativity.value}/10 (${level.name}): ${level.rule}`)
  }
  if (s.questions.on) out.push(questionRule(s.questions.value))
  if (s.expertise.on) {
    const ex = expertiseById(s.expertise.value)
    out.push(`Audience (${ex.label.toLowerCase()}): ${ex.rule}`)
  }
  const finish = finishRules(s)
  if (finish.length) {
    out.push(
      `At the end of every reply, however short (a message that only asks the user your clarifying questions isn't a reply yet, so it needs none of this):\n${finish.map((f) => `  - ${f}`).join('\n')}`,
    )
  }
  return out
}

// The full rule set: sent at the start of a conversation, after compaction, and whenever the settings change.
export function fullBlock(settings: Settings, opts: { changed?: boolean } = {}): string | null {
  const s = normalize(settings)
  if (!s.enabled) return null
  const list = rules(s)
  if (!list.length) return opts.changed ? 'Customizer 0 settings changed: every Customizer 0 rule is now off. Work normally.' : null
  const head = opts.changed
    ? 'Customizer 0 settings changed. These replace the earlier Customizer 0 settings, and anything not listed is back to your normal behavior:'
    : "Customizer 0 is on. These are the user's own settings from their Customizer 0 control panel. Follow them until they change:"
  return `${head}\n${list.map((r) => `- ${r}`).join('\n')}`
}

function checksOn(s: Settings): string[] {
  return [s.recheck.on && 'a recheck', s.painPoints.on && 'possible issues', s.safety.on && 'possible safety issues'].filter(
    (f): f is string => typeof f === 'string',
  )
}

// A one-line reminder for prompts where nothing changed, so the rules stay fresh without repeating them.
export function compactLine(settings: Settings): string | null {
  const s = normalize(settings)
  if (!s.enabled) return null
  const bits: string[] = []
  if (s.creativity.on) bits.push(`creativity ${s.creativity.value}/10 (${CREATIVITY[s.creativity.value]!.name})`)
  if (s.questions.on) {
    const n = s.questions.value
    bits.push(n === 0 ? 'no clarifying questions' : `${n} clarifying question${n === 1 ? '' : 's'} before each new request`)
  }
  if (s.expertise.on) bits.push(`written for a ${expertiseById(s.expertise.value).label.toLowerCase()}`)
  const finish = checksOn(s)
  if (finish.length) bits.push(`end every reply with ${joinList(finish)}`)
  if (!bits.length) return null
  return `Customizer 0 is still on with the same settings: ${bits.join('; ')}. Follow the full Customizer 0 rules from earlier in this session.`
}

export function offNotice(): string {
  return 'Customizer 0 was switched off. From now on, ignore the earlier Customizer 0 rules (creativity, question counts, audience, required end sections) and work normally.'
}

// Why the Stop hook is sending Claude back to work.
export function stopReason(missing: readonly CheckId[], files: readonly string[] = []): string {
  const parts: string[] = []
  if (missing.includes('recheck')) {
    const names = files.slice(0, 4).map(basename)
    const extra = files.length > 4 ? `, and ${files.length - 4} more` : ''
    const changed = names.length ? ` and the files you changed (${names.join(', ')}${extra}), running any tests or checks the project has` : ''
    parts.push(
      `recheck your response: re-read it${changed}, check that it answers what was asked and that its facts hold up, fix what you find, then write a line like ${code(`${MARK} recheck ✓ · what you checked`)}`,
    )
  }
  if (missing.includes('painPoints')) {
    parts.push('add a short "Possible issues" section: the ways your reply or what you built could go wrong for the user, each with a fix')
  }
  if (missing.includes('safety')) {
    parts.push('add a short "Possible safety issues" section: security, privacy, data-loss, legal, or misuse risks, each with a fix, or what you checked if you found none')
  }
  return `Customizer 0 finish checks (the user turned these on for every reply): before you finish, ${parts.join('; then ')}.`
}

// What `/mod preview` shows: exactly what Claude would get at the start of a conversation.
export function preview(settings: Settings): string {
  const s = normalize(settings)
  if (!s.enabled) return 'Customizer 0 is off, so Claude gets nothing extra.'
  return fullBlock(s) || 'Every setting is off, so Claude gets nothing extra.'
}

// What `/mod status` shows.
export function statusText(settings: Settings): string {
  const s = normalize(settings)
  const onOff = (v: boolean) => (v ? 'on ' : 'off')
  return [
    `Customizer 0 is ${s.enabled ? 'ON' : 'OFF'}`,
    `  Creativity              ${onOff(s.creativity.on)}  ${s.creativity.value}/10 ${CREATIVITY[s.creativity.value]!.name}`,
    `  Questions to ask        ${onOff(s.questions.on)}  ${s.questions.value}`,
    `  Coding expertise        ${onOff(s.expertise.on)}  ${expertiseById(s.expertise.value).label}`,
    `  Recheck response        ${onOff(s.recheck.on)}`,
    `  Possible issues         ${onOff(s.painPoints.on)}`,
    `  Possible safety issues  ${onOff(s.safety.on)}`,
    `  Scripted runs           ${s.headless ? 'included' : 'left alone'}`,
  ].join('\n')
}

// The quiet line under the prompt while the mod is steering Claude; nothing while it isn't.
export function statusLine(settings: Settings): string | undefined {
  const s = normalize(settings)
  if (!s.enabled) return undefined
  const bits: string[] = []
  if (s.creativity.on) bits.push(`creativity ${s.creativity.value}`)
  if (s.questions.on) bits.push(s.questions.value === 0 ? 'no questions' : `${s.questions.value} question${s.questions.value === 1 ? '' : 's'}`)
  if (s.expertise.on) bits.push(expertiseById(s.expertise.value).label.toLowerCase())
  const checks = [s.recheck.on && 'recheck response', s.painPoints.on && 'possible issues', s.safety.on && 'possible safety issues'].filter(
    (c): c is string => typeof c === 'string',
  )
  if (checks.length) bits.push(`checks: ${checks.join(', ')}`)
  return bits.length ? `Customizer 0 · ${bits.join(' · ')}` : undefined
}
