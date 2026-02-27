import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { getUserRewardsData, updateUserRewardFields } from "../_lib/repos/user-repo.js"
import { diffIsoDays, getTodayLocalDate, normalizeDateString } from "../_lib/rewards/date-utils.js"

const INACTIVITY_RESET_DAYS = 90
const INACTIVITY_WARNING_DAYS = 75

function applyStreakStaleCheck(rewards: Record<string, unknown>): void {
  const lastActiveDate = normalizeDateString(rewards.lastActiveDate as string | null | undefined)
  if (!lastActiveDate || (rewards.currentStreak as number) <= 0) {
    return
  }

  const diffDays = diffIsoDays(lastActiveDate, getTodayLocalDate())
  if (diffDays !== null && diffDays > 1) {
    rewards.currentStreak = 0
  }
}

/**
 * Check inactivity and apply streak reset (90+ days) or warning (75-89 days).
 * After inactivity only the streak resets — scores, badges, and level stay forever.
 * Returns { streakReset, inactivityWarning } metadata to include in response.
 */
function checkInactivity(rewards: Record<string, unknown>): {
  streakReset?: boolean
  inactivityWarning?: { daysInactive: number; daysUntilReset: number }
} {
  const lastActiveDate = normalizeDateString(rewards.lastActiveDate as string | null | undefined)
  if (!lastActiveDate) return {}

  const daysInactive = diffIsoDays(lastActiveDate, getTodayLocalDate())
  if (daysInactive === null || daysInactive < INACTIVITY_WARNING_DAYS) return {}

  if (daysInactive >= INACTIVITY_RESET_DAYS) {
    // Only reset streak — scores, badges, and level stay forever
    rewards.currentStreak = 0
    return { streakReset: true }
  }

  // Warning range: 75-89 days
  return {
    inactivityWarning: {
      daysInactive,
      daysUntilReset: INACTIVITY_RESET_DAYS - daysInactive
    }
  }
}

async function handleGetPostgres(_req: Request, res: Response, userId: string) {
  const data = await getUserRewardsData(userId)
  if (!data) {
    return sendError(res, "User not found", 404)
  }

  const { user, habitCount, methodCount, methodPointsSum, personalGoalCount, overtuigingCount: _overtuigingCount } = data

  let badges: string[] = []
  try {
    badges = JSON.parse(user.badges)
  } catch {
    badges = []
  }

  // Coalesce nullable DB fields to safe defaults
  const bonusPoints = user.bonusPoints ?? 0
  const totalPoints = user.totalPoints ?? 0
  const level = user.level ?? 0
  const mfScore = user.mentalFitnessScore ?? 0
  const pgScore = user.personalGoalsScore ?? 0
  const ghScore = user.goodHabitsScore ?? 0

  // Use stored scores from Postgres; fall back to on-the-fly calculation
  // for pre-backfill state (all stored scores are 0 but user has activity)
  const hasActivity = bonusPoints > 0 || methodCount > 0 || habitCount > 0 || personalGoalCount > 0
  const hasStoredScores = totalPoints > 0 || mfScore > 0 || pgScore > 0 || ghScore > 0
  const useStored = hasStoredScores || !hasActivity

  const rewards: Record<string, unknown> = {
    totalPoints: useStored ? totalPoints : (methodPointsSum) + (personalGoalCount * 5) + (habitCount * 5) + bonusPoints,
    bonusPoints,
    currentStreak: user.currentStreak ?? 0,
    longestStreak: user.longestStreak ?? 0,
    lastActiveDate: user.lastActiveDate,
    badges,
    level,
    mentalFitnessScore: useStored ? mfScore : methodPointsSum + bonusPoints,
    personalGoalsScore: useStored ? pgScore : personalGoalCount * 5,
    goodHabitsScore: useStored ? ghScore : habitCount * 5
  }

  applyStreakStaleCheck(rewards)

  const inactivityMeta = checkInactivity(rewards)

  // Persist streak reset to Postgres so it doesn't re-trigger on next request
  if (inactivityMeta.streakReset) {
    await updateUserRewardFields({
      userId,
      bonusPoints: user.bonusPoints,
      currentStreak: 0,
      longestStreak: user.longestStreak,
      lastActiveDate: user.lastActiveDate,
      badges,
      level: user.level,
      // Don't reset scores — they stay forever
    })
  }

  return sendSuccess(res, { ...rewards, ...inactivityMeta })
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const auth = await requireAuth(req)
    return handleGetPostgres(req, res, auth.userId)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
