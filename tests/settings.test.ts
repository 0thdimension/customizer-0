import { expect, test } from 'claude-code/testing'
import { applyPatch, behaviorKey, defaults, normalize } from '../hooks/settings'

test('every setting starts switched off, and unknown keys are dropped', () => {
  const d = normalize({})
  expect(d.enabled).toBe(true)
  for (const k of ['creativity', 'questions', 'expertise', 'painPoints', 'safety', 'recheck'] as const) expect(d[k].on, k).toBe(false)
  expect(d.headless).toBe(false)
  const odd = normalize({ color: 'red', extra: { on: true }, creativity: { on: true, value: 8 } })
  for (const gone of ['color', 'extra']) expect(gone in odd, gone).toBe(false)
  expect(odd.creativity).toEqual({ on: true, value: 8 })
  expect(normalize(undefined)).toEqual(defaults())
})

test('patches validate, clamp, and switch a setting on when its value changes', () => {
  let s = applyPatch(defaults(), { creativity: { value: 8 } })
  expect(s.creativity).toEqual({ on: true, value: 8 })
  s = applyPatch(s, { creativity: { value: 99 } })
  expect(s.creativity.value).toBe(10)
  s = applyPatch(s, { questions: { value: -4 } })
  expect(s.questions.value).toBe(0)
  s = applyPatch(s, { questions: { value: 'lots' } })
  expect(s.questions.value, 'an invalid value keeps the current one').toBe(0)
  s = applyPatch(s, { enabled: 'yes', expertise: { value: 'wizard' } })
  expect(s.enabled).toBe(true)
  expect(s.expertise).toEqual({ on: false, value: 'intermediate' })
  s = applyPatch(s, { creativity: { on: false, value: 3 } })
  expect(s.creativity, 'an explicit on: false wins').toEqual({ on: false, value: 3 })
  expect(applyPatch(s, { headless: true }).headless).toBe(true)
})

test('the rules key ignores switched-off values', () => {
  const a = defaults()
  expect(behaviorKey(applyPatch(a, { creativity: { on: false, value: 9 } }))).toBe(behaviorKey(a))
  expect(behaviorKey(applyPatch(a, { creativity: { value: 9 } }))).not.toBe(behaviorKey(a))
  expect(behaviorKey({ ...a, enabled: false })).toBe('off')
})
