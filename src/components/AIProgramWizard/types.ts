import type { Goal, Day, Program } from "@/types/program"

export interface AIWizardState {
  goals: string[]
  startDate: string
  duration: string
  daysOfWeek: string[]
}

export type AIWizardPhase = "input" | "generating" | "result" | "error"

export interface AIScheduleMethod {
  methodId: string
  methodName: string
  duration: number
  order: number
}

export interface AIScheduleDay {
  dayId: string
  dayName: string
  methods: AIScheduleMethod[]
}

export interface AIGenerateResult {
  program: Program
  aiSchedule: AIScheduleDay[]
  totalSessionTime: number
  weeklySessionTime: number
  recommendations: string[]
}

export interface AIInputFormProps {
  state: AIWizardState
  updateState: (updates: Partial<AIWizardState>) => void
  goalsData: Goal[]
  daysData: Day[]
  isLoading: boolean
  onGenerate: () => void
  onCancel: () => void
}

export interface ProgramResultProps {
  result: AIGenerateResult
  onViewProgram: () => void
  onCreateNew: () => void
}

export const DURATION_OPTIONS = [
  { value: "1 week", label: "1 week" },
  { value: "2 weken", label: "2 weken" },
  { value: "3 weken", label: "3 weken" },
  { value: "4 weken", label: "4 weken" },
  { value: "6 weken", label: "6 weken" },
  { value: "8 weken", label: "8 weken" }
]

export const LOADING_MESSAGES = [
  "We analyseren je doelen...",
  "We selecteren de beste methodes...",
  "We stellen je schema samen...",
  "We optimaliseren je programma...",
  "Bijna klaar..."
]

// Order days correctly (Monday first)
export const DAY_ORDER = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]
