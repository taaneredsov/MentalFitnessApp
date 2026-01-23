import { LEVELS, BADGES, type LevelInfo, type BadgeId, type BadgeInfo } from "@/types/rewards"

/**
 * Calculate level from total points
 */
export function calculateLevel(points: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].points) {
      return LEVELS[i].level
    }
  }
  return 1
}

/**
 * Get level info for a given level number
 */
export function getLevelInfo(level: number): LevelInfo {
  return LEVELS[level - 1] || LEVELS[0]
}

/**
 * Get progress to next level
 */
export function getProgressToNextLevel(points: number): {
  currentLevel: LevelInfo
  nextLevel: LevelInfo | null
  pointsInLevel: number
  pointsNeeded: number
  progressPercent: number
} {
  const currentLevelNum = calculateLevel(points)
  const currentLevel = getLevelInfo(currentLevelNum)
  const nextLevel = currentLevelNum < 10 ? getLevelInfo(currentLevelNum + 1) : null

  if (!nextLevel) {
    // Max level reached
    return {
      currentLevel,
      nextLevel: null,
      pointsInLevel: points - currentLevel.points,
      pointsNeeded: 0,
      progressPercent: 100
    }
  }

  const pointsInLevel = points - currentLevel.points
  const pointsNeeded = nextLevel.points - currentLevel.points
  const progressPercent = Math.min(100, Math.round((pointsInLevel / pointsNeeded) * 100))

  return {
    currentLevel,
    nextLevel,
    pointsInLevel,
    pointsNeeded,
    progressPercent
  }
}

/**
 * Get badge info by ID
 */
export function getBadgeInfo(badgeId: string): BadgeInfo | undefined {
  return BADGES[badgeId as BadgeId]
}

/**
 * Get all badges with earned status
 */
export function getAllBadgesWithStatus(earnedBadges: string[]): Array<BadgeInfo & { earned: boolean }> {
  return Object.values(BADGES).map(badge => ({
    ...badge,
    earned: earnedBadges.includes(badge.id)
  }))
}

/**
 * Format points for display (e.g., 1234 -> "1.234")
 */
export function formatPoints(points: number): string {
  return points.toLocaleString("nl-NL")
}

/**
 * Get streak emoji based on streak length
 */
export function getStreakEmoji(streak: number): string {
  if (streak >= 30) return "🔥"
  if (streak >= 14) return "🔥"
  if (streak >= 7) return "🔥"
  if (streak >= 3) return "🔥"
  if (streak >= 1) return "🔥"
  return ""
}

/**
 * Get today's date in YYYY-MM-DD format
 * Uses local timezone instead of UTC to prevent issues for European users
 */
export function getTodayDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Check if a date is today
 */
export function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false
  return dateStr === getTodayDate()
}

/**
 * Program milestone thresholds and points
 */
export const PROGRAM_MILESTONES = [
  { threshold: 25, points: 25 },
  { threshold: 50, points: 50 },
  { threshold: 75, points: 75 },
  { threshold: 100, points: 100 }
] as const

export type MilestoneThreshold = 25 | 50 | 75 | 100

/**
 * Check if a new program milestone has been reached
 * @param completedMethods Number of methods completed in the program
 * @param totalMethods Total number of methods in the program
 * @param alreadyAwarded Array of milestones already awarded (as strings like "25", "50")
 * @returns The newly reached milestone with points, or null if no new milestone
 */
export function checkProgramMilestones(
  completedMethods: number,
  totalMethods: number,
  alreadyAwarded: string[]
): { milestone: MilestoneThreshold; points: number } | null {
  if (totalMethods === 0) return null

  const progress = Math.round((completedMethods / totalMethods) * 100)

  for (const m of PROGRAM_MILESTONES) {
    if (progress >= m.threshold && !alreadyAwarded.includes(String(m.threshold))) {
      return { milestone: m.threshold as MilestoneThreshold, points: m.points }
    }
  }
  return null
}

/**
 * Get milestone badge ID for a given threshold
 */
export function getMilestoneBadgeId(milestone: MilestoneThreshold): string | null {
  switch (milestone) {
    case 25: return "kwart_programma"
    case 50: return "half_programma"
    case 75: return "driekwart_programma"
    case 100: return "eerste_programma"
    default: return null
  }
}

/**
 * Get milestone display text for toast notification
 */
export function getMilestoneDisplayText(milestone: MilestoneThreshold): string {
  switch (milestone) {
    case 25: return "25% voltooid!"
    case 50: return "Halverwege!"
    case 75: return "75% voltooid!"
    case 100: return "Programma afgerond!"
    default: return `${milestone}% voltooid!`
  }
}
