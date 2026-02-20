export type AirtableProgramStatus = "Actief" | "Gepland" | "Afgewerkt"
export type ProgramCreationType = "Manueel" | "AI"

export interface Program {
  id: string
  name?: string
  startDate: string
  endDate: string
  duration: string
  daysOfWeek: string[]
  frequency: number
  goals: string[]
  methods: string[]
  notes?: string
  methodUsageCount?: number  // Count of linked Methodegebruik records
  milestonesAwarded?: string[]  // Milestones already awarded (e.g., ["25", "50"])
  totalMethods?: number  // Total methods scheduled in program
  completedMethods?: number  // Methods completed so far
  status?: AirtableProgramStatus | null  // Actief/Gepland/Afgewerkt (Airtable field)
  creationType?: ProgramCreationType  // Manueel/AI - how the program was created
  overtuigingen?: string[]
}

export interface Programmaplanning {
  id: string
  planningId?: string
  programId?: string
  date: string
  dayOfWeekId?: string
  sessionDescription?: string
  methodIds: string[]
  goalIds: string[]
  methodUsageIds: string[]
  completedMethodIds: string[]  // Method IDs that have been completed in this session
  isCompleted: boolean
  notes?: string
}

export interface ProgramDetail extends Program {
  goalDetails: Goal[]
  methodDetails: Method[]
  overtuigingDetails: Overtuiging[]
  dayNames: string[]
  schedule: Programmaplanning[]
  totalSessions: number
  completedSessions: number
  totalMethods: number
  completedMethods: number
  milestonesAwarded: string[]  // Milestones already awarded (e.g., ["25", "50"])
}

export interface Goal {
  id: string
  name: string
  description?: string
  status: "Actief" | "Afgerond" | "Gepland"
}

export interface Day {
  id: string
  name: string  // Maandag, Dinsdag, etc.
}

export interface CreateProgramData {
  userId: string
  startDate: string
  duration: string
  goals?: string[]
  daysOfWeek?: string[]
  methods?: string[]
  notes?: string
}

export interface MediaItem {
  id: string
  filename: string
  type: string  // "video" or "audio"
  url: string
}

export interface Method {
  id: string
  name: string
  duration: number
  description?: string
  techniek?: string
  experienceLevel?: string
  optimalFrequency?: string[]  // Array of frequency options (Dagelijks, Wekelijks, etc.)
  linkedGoalIds?: string[]  // Linked record IDs to Goals
  photo?: string
  media?: string[]  // Linked record IDs to Media table
}

export interface MethodDetail extends Method {
  mediaDetails?: MediaItem[]
}

export interface MethodUsage {
  id: string
  userId?: string
  methodId?: string
  methodName?: string
  programId?: string  // Used for unscheduled practice (no session context)
  programmaplanningId?: string
  usedAt?: string
  remark?: string
}

export type ProgramStatus = "planned" | "running" | "finished"

// Personal Goals Types
export interface PersonalGoal {
  id: string
  name: string
  description?: string
  userId: string
  status: "Actief" | "Voltooid" | "Verwijderd"
  scheduleDays?: string[]  // ["Maandag", "Dinsdag"]
  createdAt?: string
}

export interface CreatePersonalGoalData {
  name: string
  description?: string
  scheduleDays?: string[]
}

export interface UpdatePersonalGoalData {
  name?: string
  description?: string
  status?: "Actief" | "Voltooid" | "Verwijderd"
  scheduleDays?: string[]
}

// Overtuigingen Types
export interface Overtuiging {
  id: string
  name: string
  categoryIds: string[]
  goalIds?: string[]
  order: number
  levels?: string[]
}

export interface MindsetCategory {
  id: string
  name: string
  overtuigingIds: string[]
  goalIds: string[]
  order: number
  content?: string
}

export interface PersoonlijkeOvertuiging {
  id: string
  name: string
  userId: string
  programId?: string
  status: "Actief" | "Afgerond"
  completedDate?: string
}

export interface CreatePersoonlijkeOvertuigingData {
  name: string
  programId?: string
}

export interface UpdatePersoonlijkeOvertuigingData {
  name?: string
  status?: "Actief" | "Afgerond"
}

export interface OvertuigingProgress {
  completed: boolean
}

/** Map of overtuigingId -> progress */
export type OvertuigingUsageMap = Record<string, OvertuigingProgress>

// Programmaplanning Update Types
export interface UpdateProgrammaplanningData {
  methods: string[]  // Method record IDs (required, min 1)
  goals?: string[]   // Goal record IDs (optional)
  notes?: string     // Session notes (optional)
}

// AI Program Generation Types
export interface AIGenerateRequest {
  userId: string
  goals: string[]
  startDate: string
  duration: string
  daysOfWeek: string[]
}

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

export interface AIGenerateResponse {
  program: Program
  aiSchedule: AIScheduleDay[]
  weeklySessionTime: number
  recommendations: string[]
  programSummary?: string
}

// AI Program Preview (no saving to Airtable)
export interface AIPreviewRequest {
  userId: string
  goals: string[]
  startDate: string
  duration: string
  daysOfWeek: string[]
}

export interface AIPreviewResponse {
  aiSchedule: AIScheduleDay[]
  weeklySessionTime: number
  recommendations: string[]
  programSummary?: string
  availableMethods: Method[]
  selectedGoals: Goal[]
  suggestedOvertuigingen?: Overtuiging[]
}

// AI Program Confirm (save to Airtable)
export interface AIConfirmRequest {
  userId: string
  goals: string[]
  startDate: string
  duration: string
  daysOfWeek: string[]
  editedSchedule: AIScheduleDay[]
  programSummary?: string
  overtuigingen?: string[]
}

/**
 * Calculate program status based on dates
 */
export function getProgramStatus(program: Program): ProgramStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = new Date(program.startDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(program.endDate)
  end.setHours(0, 0, 0, 0)

  if (today < start) return "planned"
  if (today > end) return "finished"
  return "running"
}

/**
 * Get next scheduled day from a list of day names
 */
export function getNextScheduledDay(
  dayNames: string[]
): { day: string; isToday: boolean; daysUntil: number } | null {
  if (!dayNames.length) return null

  const dutchDays = [
    "Zondag",
    "Maandag",
    "Dinsdag",
    "Woensdag",
    "Donderdag",
    "Vrijdag",
    "Zaterdag"
  ]
  const today = new Date()
  const todayIndex = today.getDay()

  for (let i = 0; i < 7; i++) {
    const checkIndex = (todayIndex + i) % 7
    const dayName = dutchDays[checkIndex]
    if (dayNames.includes(dayName)) {
      return {
        day: dayName,
        isToday: i === 0,
        daysUntil: i
      }
    }
  }
  return null
}

/**
 * Format next day for display
 */
export function formatNextDay(nextDay: {
  day: string
  isToday: boolean
  daysUntil: number
}): string {
  if (nextDay.isToday) return "Vandaag"
  if (nextDay.daysUntil === 1) return "Morgen"
  return nextDay.day
}

/**
 * Parse weeks from duration string (e.g., "4 weken" -> 4)
 */
export function parseWeeksFromDuration(duration: string): number {
  const match = duration.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Calculate method-based progress percentage
 * Progress = completed methods / total methods
 * This provides partial progress credit for each method completed
 */
export function getSessionProgress(programDetail: ProgramDetail): number {
  const { totalMethods, completedMethods } = programDetail

  if (totalMethods === 0) return 0

  const progress = Math.round((completedMethods / totalMethods) * 100)
  return Math.min(progress, 100) // Cap at 100%
}

/**
 * Check if any program in the list is currently running
 * Used to enforce the one-active-program limit
 */
export function hasRunningProgram(programs: Program[]): boolean {
  return programs.some(p => getProgramStatus(p) === "running")
}

/**
 * Get the currently running program from a list
 * Returns undefined if no program is running
 */
export function getRunningProgram(programs: Program[]): Program | undefined {
  return programs.find(p => getProgramStatus(p) === "running")
}
