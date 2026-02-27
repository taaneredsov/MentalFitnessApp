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
  // Split scores (calculated by Airtable formulas)
  mentalFitnessScore: number
  personalGoalsScore: number
  goodHabitsScore: number
  // Inactivity detection (75-89 days inactive)
  inactivityWarning?: { daysInactive: number; daysUntilReset: number }
  // Streak was reset due to 90+ days inactivity (scores/badges/level stay)
  streakReset?: boolean
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
  activityType: "method" | "habit" | "program" | "sessionBonus" | "habitDayBonus" | "programMilestone" | "overtuiging" | "personalGoal"
  activityId?: string
  // Program milestone fields
  programId?: string
  milestone?: number
  activityDate?: string
}

/**
 * Point values for each activity type
 */
export const POINTS = {
  // Method points are variable (1-10, from Airtable "Punten waarde")
  // No fixed method constant — read from method record
  habit: 5,
  personalGoal: 5,
  overtuiging: 1,
  // Streak bonuses (program-aligned)
  streak7: 25,
  streak21: 75,
  programComplete: 100
} as const

/**
 * Level definitions with thresholds and titles
 */
export const LEVELS = [
  { level: 1, points: 0, title: "Beginner" },
  { level: 2, points: 50, title: "Ontdekker" },
  { level: 3, points: 125, title: "Beoefenaar" },
  { level: 4, points: 250, title: "Doorzetter" },
  { level: 5, points: 400, title: "Gevorderde" },
  { level: 6, points: 600, title: "Expert" },
  { level: 7, points: 850, title: "Kampioen" },
  { level: 8, points: 1150, title: "Meester" },
  { level: 9, points: 1500, title: "Legende" },
  { level: 10, points: 2000, title: "Mentale Atleet" }
] as const

export type LevelInfo = (typeof LEVELS)[number]

/**
 * Badge definitions with metadata
 */
export const BADGES = {
  // Tier 1: Eerste Stappen
  eerste_sessie: { id: "eerste_sessie", name: "Eerste Sessie", description: "Voltooi je eerste methode", icon: "star", tier: 1 },
  eerste_streak: { id: "eerste_streak", name: "Eerste Streak", description: "3 opeenvolgende sessies op tijd", icon: "flame", tier: 1 },
  eerste_week: { id: "eerste_week", name: "Eerste Week", description: "Alle sessies voltooid in week 1", icon: "calendar-check", tier: 1 },
  goede_start: { id: "goede_start", name: "Goede Start", description: "Log je eerste gewoonte of persoonlijk doel", icon: "heart", tier: 1 },
  // Tier 2: Consistentie
  op_dreef: { id: "op_dreef", name: "Op Dreef", description: "21 opeenvolgende sessies op tijd", icon: "zap", tier: 2 },
  tweede_programma: { id: "tweede_programma", name: "Tweede Programma", description: "Start een 2e programma", icon: "refresh-cw", tier: 2 },
  drie_maanden: { id: "drie_maanden", name: "Drie Maanden", description: "3 maanden actief", icon: "clock", tier: 2 },
  veelzijdig: { id: "veelzijdig", name: "Veelzijdig", description: "Methode + gewoonte + doel in één week", icon: "layers", tier: 2 },
  // Tier 3: Mentale Atleet
  programma_voltooid: { id: "programma_voltooid", name: "Programma Voltooid", description: "Rond een volledig programma af", icon: "trophy", tier: 3 },
  zes_maanden: { id: "zes_maanden", name: "Zes Maanden", description: "6 maanden actief", icon: "shield", tier: 3 },
  jaar_actief: { id: "jaar_actief", name: "Jaar Actief", description: "12 maanden actief", icon: "crown", tier: 3 },
  mentale_atleet: { id: "mentale_atleet", name: "Mentale Atleet", description: "Bereik niveau 8", icon: "medal", tier: 3 }
} as const

export type BadgeId = keyof typeof BADGES
export type BadgeInfo = (typeof BADGES)[BadgeId]
