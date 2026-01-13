export interface Program {
  id: string
  startDate: string
  endDate: string
  duration: string
  daysOfWeek: string[]
  frequency: number
  goals: string[]
  methods: string[]
  sessionTime: number
  notes?: string
}

export interface ProgramDetail extends Program {
  goalDetails: Goal[]
  methodDetails: Method[]
  dayNames: string[]
}

export interface Goal {
  id: string
  name: string
  description?: string
  status: "Actief" | "Afgerond" | "Gepland"
}

export interface Method {
  id: string
  name: string
  duration: number
  description?: string
  photo?: string
}

export type ProgramStatus = "planned" | "running" | "finished"

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
