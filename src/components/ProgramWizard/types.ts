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
  { value: "1 week", label: "1 week" },
  { value: "2 weken", label: "2 weken" },
  { value: "3 weken", label: "3 weken" },
  { value: "4 weken", label: "4 weken" },
  { value: "6 weken", label: "6 weken" },
  { value: "8 weken", label: "8 weken" }
]

export const STEPS = [
  { title: "Basis", description: "Startdatum en duur" },
  { title: "Doelen", description: "Wat wil je bereiken?" },
  { title: "Mindset", description: "Kies overtuigingen" },
  { title: "Schema", description: "Wanneer train je?" },
  { title: "Methodes", description: "Jouw oefeningen" },
  { title: "Bevestig", description: "Overzicht" }
]
