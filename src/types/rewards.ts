/**
 * User rewards data from API
 */
export interface UserRewards {
  totalPoints: number
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  badges: string[]
  level: number
}

/**
 * Response from POST /api/rewards/award
 */
export interface AwardResponse {
  pointsAwarded: number
  newTotal: number
  newBadges: string[]
  levelUp: boolean
  newLevel: number
  currentStreak: number
  longestStreak: number
  milestone?: number  // Milestone reached (25, 50, 75, 100) if this was a milestone award
}

/**
 * Request body for POST /api/rewards/award
 */
export interface AwardRequest {
  activityType: "method" | "habit" | "program" | "sessionBonus" | "habitDayBonus" | "programMilestone"
  activityId?: string
  methodsCompleted?: number
  habitsCompleted?: number
  habitDaysCompleted?: number
  programsCompleted?: number
  // Program milestone fields
  programId?: string
  milestone?: number
}

/**
 * Point values for each activity type
 */
export const POINTS = {
  method: 10,
  sessionBonus: 5,
  habit: 5,
  habitDayBonus: 5,
  personalGoal: 10,  // Bonus points for completing a personal goal
  streakWeek: 50,
  streakMonth: 200,
  program: 100,
  // Program milestones
  milestone25: 25,
  milestone50: 50,
  milestone75: 75,
  milestone100: 100
} as const

/**
 * Level definitions with thresholds and titles
 */
export const LEVELS = [
  { level: 1, points: 0, title: "Beginner" },
  { level: 2, points: 50, title: "Ontdekker" },
  { level: 3, points: 150, title: "Beoefenaar" },
  { level: 4, points: 350, title: "Doorzetter" },
  { level: 5, points: 600, title: "Expert" },
  { level: 6, points: 1000, title: "Meester" },
  { level: 7, points: 1500, title: "Kampioen" },
  { level: 8, points: 2500, title: "Legende" },
  { level: 9, points: 4000, title: "Goeroe" },
  { level: 10, points: 6000, title: "Mentale Atleet" }
] as const

export type LevelInfo = (typeof LEVELS)[number]

/**
 * Badge definitions with metadata
 */
export const BADGES = {
  // Progress badges
  eerste_sessie: {
    id: "eerste_sessie",
    name: "Eerste Sessie",
    description: "Voltooi je eerste methode",
    icon: "star"
  },
  vijf_methodes: {
    id: "vijf_methodes",
    name: "Op Dreef",
    description: "Voltooi 5 methodes",
    icon: "zap"
  },
  twintig_methodes: {
    id: "twintig_methodes",
    name: "Doorgewinterd",
    description: "Voltooi 20 methodes",
    icon: "trophy"
  },
  eerste_programma: {
    id: "eerste_programma",
    name: "Programma Afgerond",
    description: "Rond je eerste programma af",
    icon: "award"
  },
  // Program milestone badges
  kwart_programma: {
    id: "kwart_programma",
    name: "Kwart Klaar",
    description: "25% van een programma voltooid",
    icon: "seedling"
  },
  half_programma: {
    id: "half_programma",
    name: "Halverwege",
    description: "50% van een programma voltooid",
    icon: "star"
  },
  driekwart_programma: {
    id: "driekwart_programma",
    name: "Bijna Daar",
    description: "75% van een programma voltooid",
    icon: "flame"
  },
  // Streak badges
  week_streak: {
    id: "week_streak",
    name: "Week Warrior",
    description: "7 dagen op rij actief",
    icon: "flame"
  },
  twee_weken_streak: {
    id: "twee_weken_streak",
    name: "Constante Kracht",
    description: "14 dagen op rij actief",
    icon: "flame"
  },
  maand_streak: {
    id: "maand_streak",
    name: "Maand Meester",
    description: "30 dagen op rij actief",
    icon: "flame"
  },
  // Habit badges
  goede_start: {
    id: "goede_start",
    name: "Goede Start",
    description: "Voltooi je eerste gewoonte",
    icon: "heart"
  },
  dagelijkse_held: {
    id: "dagelijkse_held",
    name: "Dagelijkse Held",
    description: "Voltooi alle gewoontes op een dag",
    icon: "check-circle"
  },
  week_gewoontes: {
    id: "week_gewoontes",
    name: "Gewoonte Guru",
    description: "7 dagen alle gewoontes voltooid",
    icon: "crown"
  }
} as const

export type BadgeId = keyof typeof BADGES
export type BadgeInfo = (typeof BADGES)[BadgeId]
