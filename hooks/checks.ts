// The finish checks: which ones Claude's last message is missing, and which files a tool call changed.
import type { Settings } from '../types'
import { MARK } from './catalog'

export type CheckId = 'recheck' | 'painPoints' | 'safety'

const RECHECK_LINE = /^[\t >*+-]*`?\s*◆\s*recheck\b/i

// A recheck line counts only on a line of its own, outside code blocks.
export function hasRecheck(text: unknown): boolean {
  if (typeof text !== 'string' || !text.includes(MARK)) return false
  let inFence = false
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (!inFence && RECHECK_LINE.test(line)) return true
  }
  return false
}

// The enabled checks that the text of Claude's final message doesn't show.
export function missingChecks(s: Settings, text: string): CheckId[] {
  const missing: CheckId[] = []
  if (s.recheck.on && !hasRecheck(text)) missing.push('recheck')
  if (s.painPoints.on && !/possible issues|pain[\s-]*points?/i.test(text)) missing.push('painPoints')
  if (s.safety.on && !/safety/i.test(text)) missing.push('safety')
  return missing
}

// A short message that ends by asking the user something: Claude is waiting on an answer, not finishing a
// reply, so the finish checks belong to the reply that follows it.
export function isClarifyingQuestion(text: string): boolean {
  const t = text.trim()
  return t.length > 0 && t.length < 600 && t.endsWith('?')
}

// The file an Edit, Write, MultiEdit or NotebookEdit call changed; tool.call carries the tool's input on e.
export function editedFile(e: unknown): string | undefined {
  const input = (e ?? {}) as { file_path?: unknown; notebook_path?: unknown }
  if (typeof input.file_path === 'string' && input.file_path) return input.file_path
  if (typeof input.notebook_path === 'string' && input.notebook_path) return input.notebook_path
  return undefined
}
