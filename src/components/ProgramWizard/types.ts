import type { Goal, Day, Method } from "@/types/program"

export interface WizardState {
  step: number
  startDate: string
  duration: string
  goals: string[]
  overtuigingen: string[]
  daysOfWeek: string[]
  methods: string[]
  notes: string
  programId?: string  // Set after initial save
  isPolling: boolean
  isSaving: boolean
}

export interface StepProps {
  state: WizardState
  updateState: (updates: Partial<WizardState>) => void
  goalsData: Goal[]
  daysData: Day[]
  methodsData: Method[]
  onNext: () => void
  onBack: () => void
  isLoading: boolean
}

export const DURATION_OPTIONS = [
  { value: "1 week", labelKey: "duration.1week" },
  { value: "2 weken", labelKey: "duration.2weeks" },
  { value: "3 weken", labelKey: "duration.3weeks" },
  { value: "4 weken", labelKey: "duration.4weeks" },
  { value: "6 weken", labelKey: "duration.6weeks" },
  { value: "8 weken", labelKey: "duration.8weeks" }
]

export const STEPS = [
  { titleKey: "wizard.step.basis.title", descriptionKey: "wizard.step.basis.description" },
  { titleKey: "wizard.step.doelen.title", descriptionKey: "wizard.step.doelen.description" },
  { titleKey: "wizard.step.mindset.title", descriptionKey: "wizard.step.mindset.description" },
  { titleKey: "wizard.step.schema.title", descriptionKey: "wizard.step.schema.description" },
  { titleKey: "wizard.step.methodes.title", descriptionKey: "wizard.step.methodes.description" },
  { titleKey: "wizard.step.confirm.title", descriptionKey: "wizard.step.confirm.description" }
]
