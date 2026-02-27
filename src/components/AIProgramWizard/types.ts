import type { Goal, Day, Program, Method, Overtuiging } from "@/types/program"

export interface AIWizardState {
  step: number
  goals: string[]
  startDate: string
  duration: string
  daysOfWeek: string[]
}

export const AI_WIZARD_STEPS = [
  { titleKey: "wizard.step.goals.title", descriptionKey: "wizard.step.goals.description" },
  { titleKey: "wizard.step.planning.title", descriptionKey: "wizard.step.planning.description" },
  { titleKey: "wizard.step.trainingDays.title", descriptionKey: "wizard.step.trainingDays.description" }
]

export type AIWizardPhase = "input" | "generating" | "review" | "confirming" | "result" | "error"

export interface AIScheduleMethod {
  methodId: string
  methodName: string
  duration: number
}

export interface AIScheduleDay {
  date: string          // YYYY-MM-DD format
  dayOfWeek: string     // Dutch day name (Maandag, etc.)
  dayId: string         // Airtable record ID
  methods: AIScheduleMethod[]
}

export interface AIGenerateResult {
  program: Program
  aiSchedule: AIScheduleDay[]
  weeklySessionTime: number
  recommendations: string[]
  programSummary?: string
  programName?: string
  selectedGoedeGewoontes?: Array<{
    goedeGewoonteId: string
    goedeGewoonteName: string
    reason: string
  }>
}

export interface AIPreviewResult {
  aiSchedule: AIScheduleDay[]
  weeklySessionTime: number
  recommendations: string[]
  programSummary?: string
  programName?: string
  availableMethods: Method[]
  selectedGoals: Goal[]
  suggestedOvertuigingen?: Overtuiging[]
  suggestedGoedeGewoontes?: Array<{
    id: string
    name: string
    reason: string
  }>
}

export interface CustomOvertuiging {
  tempId: string
  name: string
}

export interface ScheduleReviewProps {
  preview: AIPreviewResult
  editedSchedule: AIScheduleDay[]
  onScheduleChange: (schedule: AIScheduleDay[]) => void
  selectedOvertuigingen: string[]
  onOvertuigingenChange: (ids: string[]) => void
  customOvertuigingen: CustomOvertuiging[]
  onCustomOvertuigingenChange: (items: CustomOvertuiging[]) => void
  onConfirm: () => void
  onBack: () => void
  isConfirming: boolean
}

export interface AIInputFormProps {
  state: AIWizardState
  updateState: (updates: Partial<AIWizardState>) => void
  goalsData: Goal[]
  daysData: Day[]
  existingPrograms: Program[]
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
  { value: "1 week", labelKey: "duration.1week" },
  { value: "2 weken", labelKey: "duration.2weeks" },
  { value: "3 weken", labelKey: "duration.3weeks" },
  { value: "4 weken", labelKey: "duration.4weeks" },
  { value: "6 weken", labelKey: "duration.6weeks" },
  { value: "8 weken", labelKey: "duration.8weeks" }
]

export const LOADING_MESSAGE_KEYS = [
  "wizard.generating.analyzing",
  "wizard.generating.selecting",
  "wizard.generating.scheduling",
  "wizard.generating.optimizing",
  "wizard.generating.almostDone"
]

// Order days correctly (Monday first)
export const DAY_ORDER = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]
