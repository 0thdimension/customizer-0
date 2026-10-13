// The controls bar above the prompt: every setting on three rows, in the surface's own colors. It never
// touches Claude Code itself: register.tsx draws it and hands it what each control does.
import type { BoxProps, ButtonProps, ElementConstructor, SelectProps, TextProps } from 'claude-code'
import type { Settings } from '../types'
import { CHECKS, CREATIVITY, EXPERTISE } from './catalog'

export type Kit = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Select: ElementConstructor<SelectProps>
}

// What the controls do, each reading the stored settings afresh so quick presses never undo each other.
export type BarActions = {
  choose: (key: 'creativity' | 'questions' | 'expertise', value: string) => Promise<void> // a value, or 'off'
  flip: (key: 'recheck' | 'painPoints' | 'safety') => Promise<void>
  toggleMaster: () => Promise<void>
  close: () => Promise<void>
  pressReset: () => Promise<void>
}

const OFF = { value: 'off', label: 'Off' }
const CREATIVITY_OPTIONS = [OFF, ...CREATIVITY.map((c, i) => ({ value: String(i), label: `${i} · ${c.name}` }))]
const QUESTION_OPTIONS = [OFF, { value: '0', label: 'None' }, ...Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))]
const EXPERTISE_OPTIONS = [OFF, ...EXPERTISE.map((x) => ({ value: x.id, label: x.label }))]

export function barTree(kit: Kit, s: Settings, armed: boolean, act: BarActions) {
  const { Box, Text, Button, Select } = kit
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between" columnGap={2} flexWrap="wrap">
        <Box flexDirection="row" columnGap={2}>
          <Text bold>Customizer 0</Text>
          <Text dimColor>{s.enabled ? 'Changes apply from your next message.' : 'Off. Claude works normally.'}</Text>
        </Box>
        <Box flexDirection="row" columnGap={1}>
          <Button key="master" onPress={() => void act.toggleMaster()}>
            {s.enabled ? 'Turn off' : 'Turn on'}
          </Button>
          <Button key="close" role="dismiss" onPress={() => void act.close()}>
            Close
          </Button>
        </Box>
      </Box>
      <Box flexDirection="row" columnGap={3} flexWrap="wrap">
        <Select
          key="creativity"
          label="Creativity: "
          options={CREATIVITY_OPTIONS}
          value={s.creativity.on ? String(s.creativity.value) : 'off'}
          onSelect={(v) => void act.choose('creativity', v)}
        />
        <Select
          key="questions"
          label="Questions to ask: "
          options={QUESTION_OPTIONS}
          value={s.questions.on ? String(s.questions.value) : 'off'}
          onSelect={(v) => void act.choose('questions', v)}
        />
        <Select
          key="expertise"
          label="Expertise: "
          options={EXPERTISE_OPTIONS}
          value={s.expertise.on ? s.expertise.value : 'off'}
          onSelect={(v) => void act.choose('expertise', v)}
        />
      </Box>
      <Box flexDirection="row" columnGap={2} flexWrap="wrap">
        <Text dimColor>Finish checks</Text>
        {CHECKS.map((c) => (
          <Button key={`check-${c.id}`} onPress={() => void act.flip(c.id)}>
            {`${s[c.id].on ? '☑' : '☐'} ${c.label}`}
          </Button>
        ))}
        <Button key="reset" onPress={() => void act.pressReset()}>
          {armed ? 'Confirm reset' : 'Reset'}
        </Button>
      </Box>
    </Box>
  )
}
