// The shared vocabulary of Customizer 0: what each setting is called, and the rule text Claude receives
// for it. Edit wording here and every surface (the controls bar, /mod, the rules) picks it up.
import type { ExpertiseId } from '../types'

export const MARK = '◆' // starts the recheck line Claude writes

export const CREATIVITY = [
  {
    name: 'Exact',
    rule: 'Do exactly what was asked and nothing more: no extra features, no stylistic liberties, no refactors outside the request. Choose the most conventional, proven approach.',
  },
  {
    name: 'Strict',
    rule: "Stay tightly within the request and use conventional approaches. Don't add features or flourishes; if you spot a worthwhile improvement, mention it instead of doing it.",
  },
  {
    name: 'Careful',
    rule: 'Follow the request closely. Small, clearly helpful touches are fine (clearer names, a missed edge case), but no new features or unconventional designs.',
  },
  {
    name: 'Measured',
    rule: 'Mostly by the book. Make modest improvements that clearly serve the request, prefer familiar patterns, and say what you added.',
  },
  {
    name: 'Steady',
    rule: 'Lean conventional, with room for a few thoughtful improvements where they clearly help. Briefly explain any additions.',
  },
  {
    name: 'Balanced',
    rule: 'Balance doing what was asked with sensible initiative. Add improvements when they clearly make the result better, and say what you added.',
  },
  {
    name: 'Lively',
    rule: 'Bring some personality: make a few distinctive choices in design, wording, or approach beyond the literal request, while delivering everything that was asked.',
  },
  {
    name: 'Inventive',
    rule: 'Look for ways to make the result more useful or delightful than asked: propose and build fresh ideas, distinctive visuals, and extra polish. Keep every requested behavior intact and list what you added.',
  },
  {
    name: 'Bold',
    rule: 'Take real creative liberties with design and approach. Try unexpected ideas and build the strongest ones; skip the obvious solution when a more interesting one works. Deliver the core request and flag your liberties.',
  },
  {
    name: 'Daring',
    rule: 'Treat the request as a starting point. Experiment boldly with concept, form, and technique, and surprise the user, while still delivering what they need at the core. Explain your choices.',
  },
  {
    name: 'Unleashed',
    rule: "Maximum creative freedom. Reinterpret the brief, invent, and experiment as far as the idea can go, while keeping the user's core goal achievable. Clearly flag every liberty you took.",
  },
] as const

export const EXPERTISE: readonly { id: ExpertiseId; label: string; rule: string }[] = [
  {
    id: 'vibe',
    label: 'Vibe coder',
    rule: "The user builds by describing what they want and doesn't read code. Don't show code unless they ask. Explain changes by what they'll see and be able to do. Avoid jargon; if a technical word is unavoidable, explain it in a few plain words. Give exact click-by-click or copy-paste steps for anything they must do, and tell them how to check that it works.",
  },
  {
    id: 'novice',
    label: 'Novice coder',
    rule: 'The user is learning to code. Use plain language and define technical terms the first time they appear. Keep code snippets short and commented. Explain what changed and why, and give step-by-step instructions to run or test it.',
  },
  {
    id: 'intermediate',
    label: 'Intermediate coder',
    rule: 'The user is comfortable with code. Use normal technical vocabulary without defining basics. Focus on design decisions, trade-offs, and anything non-obvious, and show relevant snippets or diffs rather than whole files.',
  },
  {
    id: 'expert',
    label: 'Expert coder',
    rule: 'The user is an expert engineer. Be terse and precise and skip basics. Reference files and lines, and call out edge cases, failure modes, performance, and API details using exact technical terms.',
  },
]

export const CHECKS = [
  { id: 'recheck', label: 'Recheck response' },
  { id: 'painPoints', label: 'Possible issues' },
  { id: 'safety', label: 'Possible safety issues' },
] as const

export const EXPERTISE_IDS: readonly ExpertiseId[] = EXPERTISE.map((e) => e.id)
export const expertiseById = (id: string) => EXPERTISE.find((e) => e.id === id) ?? EXPERTISE[2]!
