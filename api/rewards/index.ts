import type { Request, Response } from "express"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { transformUserRewards } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { getUserRewardsData } from "../_lib/repos/user-repo.js"
import { diffIsoDays, getTodayLocalDate, normalizeDateString } from "../_lib/rewards/date-utils.js"
import { shouldUsePostgresRewards } from "../_lib/rewards/engine.js"

const REWARDS_BACKEND_ENV = "DATA_BACKEND_REWARDS"

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

async function handleGetPostgres(_req: Request, res: Response, userId: string) {
  const data = await getUserRewardsData(userId)
  if (!data) {
    return sendError(res, "User not found", 404)
  }

  const { user, habitCount, methodCount, personalGoalCount, overtuigingCount: _overtuigingCount } = data

  let badges: unknown[] = []
  try {
    badges = JSON.parse(user.badges)
  } catch {
    badges = []
  }

  const rewards: Record<string, unknown> = {
    totalPoints: (methodCount * 10) + (habitCount * 5) + user.bonusPoints,
    bonusPoints: user.bonusPoints,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    lastActiveDate: user.lastActiveDate,
    badges,
    level: user.level,
    mentalFitnessScore: methodCount * 10 + user.bonusPoints,
    personalGoalsScore: personalGoalCount * 10,
    goodHabitsScore: habitCount * 5
  }

  applyStreakStaleCheck(rewards)
  return sendSuccess(res, rewards)
}

async function handleGetAirtable(_req: Request, res: Response, userId: string) {
  const records = await base(tables.users)
    .select({
      filterByFormula: `RECORD_ID() = "${userId}"`,
      maxRecords: 1,
      returnFieldsByFieldId: true
    })
    .firstPage()

  if (records.length === 0) {
    return sendError(res, "User not found", 404)
  }

  const rewards = transformUserRewards(records[0] as { id: string; fields: Record<string, unknown> })

  applyStreakStaleCheck(rewards as unknown as Record<string, unknown>)
  return sendSuccess(res, rewards)
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const auth = await requireAuth(req)
    const mode = getDataBackendMode(REWARDS_BACKEND_ENV)
    const usePostgres = shouldUsePostgresRewards()

    if (usePostgres) {
      return handleGetPostgres(req, res, auth.userId)
    }

    if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
      void handleGetPostgres(req, res, auth.userId)
        .then(() => undefined)
        .catch((error) => console.warn("[rewards] shadow read failed:", error))
    }

    return handleGetAirtable(req, res, auth.userId)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
