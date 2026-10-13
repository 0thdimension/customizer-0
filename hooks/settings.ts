// Customizer 0's settings: defaults, validation, and the rules key. register.tsx keeps them in $.store.
import type { ExpertiseId, Settings } from '../types'
import { EXPERTISE_IDS } from './catalog'

export const MODULES = ['creativity', 'questions', 'expertise', 'painPoints', 'safety', 'recheck'] as const
export type ModuleId = (typeof MODULES)[number]

// Bump when the wording Claude receives changes, so chats that are already open get the new rules.
export const RULES_VERSION = 4

// A partial update shaped like the settings, as /mod and the controls bar send them.
export type Patch = {
  enabled?: boolean
  headless?: boolean
  creativity?: { on?: boolean; value?: number | string }
  questions?: { on?: boolean; value?: number | string }
  expertise?: { on?: boolean; value?: string }
  painPoints?: { on?: boolean }
  safety?: { on?: boolean }
  recheck?: { on?: boolean }
}

// Every module starts switched off, so installing changes nothing until the user turns something on.
export function defaults(): Settings {
  return {
    version: 3,
    enabled: true,
    creativity: { on: false, value: 5 },
    questions: { on: false, value: 3 },
    expertise: { on: false, value: 'intermediate' },
    painPoints: { on: false },
    safety: { on: false },
    recheck: { on: false },
    headless: false,
  }
}

type Bag = Record<string, unknown>
const isObj = (v: unknown): v is Bag => v !== null && typeof v === 'object' && !Array.isArray(v)
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d)

function int(v: unknown, lo: number, hi: number, d: number): number {
  if (v === null || v === '' || typeof v === 'boolean') return d
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d
}

// Builds clean settings from anything stored. Unknown keys are dropped.
export function normalize(input: unknown): Settings {
  const d = defaults()
  const s = isObj(input) ? input : {}
  const m = (k: string): Bag => (isObj(s[k]) ? (s[k] as Bag) : {})
  return {
    version: 3,
    enabled: bool(s.enabled, d.enabled),
    creativity: { on: bool(m('creativity').on, d.creativity.on), value: int(m('creativity').value, 0, 10, d.creativity.value) },
    questions: { on: bool(m('questions').on, d.questions.on), value: int(m('questions').value, 0, 20, d.questions.value) },
    expertise: { on: bool(m('expertise').on, d.expertise.on), value: pick<ExpertiseId>(m('expertise').value, EXPERTISE_IDS, d.expertise.value) },
    painPoints: { on: bool(m('painPoints').on, d.painPoints.on) },
    safety: { on: bool(m('safety').on, d.safety.on) },
    recheck: { on: bool(m('recheck').on, d.recheck.on) },
    headless: bool(s.headless, d.headless),
  }
}

function validValue(key: ModuleId, v: unknown): boolean {
  if (key === 'expertise') return EXPERTISE_IDS.includes(v as ExpertiseId)
  return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))
}

// Merges a partial update. Invalid fields are ignored (the current value stays). Giving a module a new
// value switches it on, because choosing a value means you want it applied.
export function applyPatch(current: unknown, patch: unknown): Settings {
  const next = normalize(current) as Settings & Record<string, unknown>
  if (!isObj(patch)) return next
  for (const [key, val] of Object.entries(patch)) {
    if ((key === 'enabled' || key === 'headless') && typeof val === 'boolean') {
      next[key] = val
    } else if ((MODULES as readonly string[]).includes(key) && isObj(val)) {
      const mod = next[key as ModuleId] as Bag
      const hasValue = 'value' in mod && 'value' in val && validValue(key as ModuleId, val.value)
      if (hasValue) mod.value = val.value
      if (typeof val.on === 'boolean') mod.on = val.on
      else if (hasValue) mod.on = true
    }
  }
  return normalize(next)
}

// Names the rules a combination of settings produces, so the hooks can tell when to send them again.
export function behaviorKey(settings: Settings): string {
  const s = normalize(settings)
  if (!s.enabled) return 'off'
  return JSON.stringify([
    RULES_VERSION,
    s.creativity.on ? s.creativity.value : null,
    s.questions.on ? s.questions.value : null,
    s.expertise.on ? s.expertise.value : null,
    s.painPoints.on,
    s.safety.on,
    s.recheck.on,
  ])
}
