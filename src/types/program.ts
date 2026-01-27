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
  experienceLevel?: string
  optimalFrequency?: string[]  // Array of frequency options (Dagelijks, Wekelijks, etc.)
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
  programId?: string  // DEPRECATED - use programmaplanningId
  programmaplanningId?: string
  usedAt?: string
  remark?: string
}

export type ProgramStatus = "planned" | "running" | "finished"

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
 * Calculate activity-based progress percentage (DEPRECATED)
 * Progress = completed activities / total expected activities
 * Total expected = weeks × frequency (days per week)
 * @deprecated Use getSessionProgress() instead for accurate Programmaplanning-level tracking
 */
export function getActivityProgress(program: Program): number {
  const weeks = parseWeeksFromDuration(program.duration)
  const frequency = program.frequency || 0
  const totalExpected = weeks * frequency

  if (totalExpected === 0) return 0

  const completed = program.methodUsageCount || 0
  const progress = Math.round((completed / totalExpected) * 100)

  return Math.min(progress, 100) // Cap at 100%
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
