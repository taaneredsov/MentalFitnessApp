import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { verifyToken } from "../_lib/jwt.js"
import { USER_FIELDS, PROGRAM_FIELDS, transformUserRewards } from "../_lib/field-mappings.js"

// Point values for each activity
const POINTS = {
  method: 10,
  sessionBonus: 5,  // Completing all methods in a session
  habit: 5,
  habitDayBonus: 5,  // Completing all habits for the day
  streakWeek: 50,
  streakMonth: 200,
  program: 100,
  // Program milestones
  milestone25: 25,
  milestone50: 50,
  milestone75: 75,
  milestone100: 100
} as const

// Milestone point lookup
const MILESTONE_POINTS: Record<number, number> = {
  25: POINTS.milestone25,
  50: POINTS.milestone50,
  75: POINTS.milestone75,
  100: POINTS.milestone100
}

// Level thresholds
const LEVELS = [
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

// Badge definitions
const BADGE_CHECKS = {
  // Progress badges
  eerste_sessie: { check: (stats: Stats) => stats.methodsCompleted >= 1 },
  vijf_methodes: { check: (stats: Stats) => stats.methodsCompleted >= 5 },
  twintig_methodes: { check: (stats: Stats) => stats.methodsCompleted >= 20 },
  eerste_programma: { check: (stats: Stats) => stats.programsCompleted >= 1 },
  // Program milestone badges
  kwart_programma: { check: (stats: Stats) => stats.milestonesReached.includes(25) },
  half_programma: { check: (stats: Stats) => stats.milestonesReached.includes(50) },
  driekwart_programma: { check: (stats: Stats) => stats.milestonesReached.includes(75) },
  // Streak badges
  week_streak: { check: (stats: Stats) => stats.longestStreak >= 7 },
  twee_weken_streak: { check: (stats: Stats) => stats.longestStreak >= 14 },
  maand_streak: { check: (stats: Stats) => stats.longestStreak >= 30 },
  // Habit badges
  goede_start: { check: (stats: Stats) => stats.habitsCompleted >= 1 },
  dagelijkse_held: { check: (stats: Stats) => stats.habitDaysCompleted >= 1 },
  week_gewoontes: { check: (stats: Stats) => stats.habitDaysCompleted >= 7 }
} as const

interface Stats {
  methodsCompleted: number
  habitsCompleted: number
  habitDaysCompleted: number
  programsCompleted: number
  longestStreak: number
  milestonesReached: number[]
}

const awardSchema = z.object({
  activityType: z.enum(["method", "habit", "program", "sessionBonus", "habitDayBonus", "programMilestone"]),
  activityId: z.string().optional(),
  // For counting stats for badges
  methodsCompleted: z.number().optional(),
  habitsCompleted: z.number().optional(),
  habitDaysCompleted: z.number().optional(),
  programsCompleted: z.number().optional(),
  // Program milestone fields
  programId: z.string().optional(),
  milestone: z.number().optional()
})

function getToday(): string {
  const now = new Date()
  return now.toISOString().split("T")[0]
}

function calculateLevel(points: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].points) {
      return LEVELS[i].level
    }
  }
  return 1
}

function calculateStreak(lastActiveDate: string | null, today: string): { currentStreak: number; isNewDay: boolean } {
  if (!lastActiveDate) {
    return { currentStreak: 1, isNewDay: true }
  }

  const lastActive = new Date(lastActiveDate)
  const todayDate = new Date(today)
  const diffDays = Math.floor((todayDate.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    // Same day - streak unchanged, not a new day
    return { currentStreak: -1, isNewDay: false }  // -1 means no change
  } else if (diffDays === 1) {
    // Consecutive day - increment streak
    return { currentStreak: 1, isNewDay: true }  // +1 to current
  } else {
    // Streak broken - reset to 1
    return { currentStreak: 1, isNewDay: true }  // reset
  }
}

function checkNewBadges(existingBadges: string[], stats: Stats): string[] {
  const newBadges: string[] = []

  for (const [badgeId, badge] of Object.entries(BADGE_CHECKS)) {
    if (!existingBadges.includes(badgeId) && badge.check(stats)) {
      newBadges.push(badgeId)
    }
  }

  return newBadges
}

/**
 * POST /api/rewards/award
 * Awards points for completing an activity
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return sendError(res, "Unauthorized", 401)
    }

    const token = authHeader.slice(7)
    const payload = await verifyToken(token)
    if (!payload) {
      return sendError(res, "Invalid token", 401)
    }

    const rawBody = parseBody(req)
    const body = awardSchema.parse(rawBody)

    // Fetch current user rewards
    const records = await base(tables.users)
      .select({
        filterByFormula: `RECORD_ID() = "${payload.userId}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (records.length === 0) {
      return sendError(res, "User not found", 404)
    }

    const currentRewards = transformUserRewards(records[0] as { id: string; fields: Record<string, unknown> })
    const today = getToday()

    // Calculate points to award based on activity type
    let pointsAwarded = 0
    if (body.activityType === "programMilestone" && body.milestone) {
      // For milestone activity, use the milestone-specific points
      pointsAwarded = MILESTONE_POINTS[body.milestone] || 0
    } else {
      // For other activity types, use the standard points
      pointsAwarded = POINTS[body.activityType as keyof typeof POINTS] || 0
    }
    const newTotal = currentRewards.totalPoints + pointsAwarded

    // Calculate streak
    const streakResult = calculateStreak(currentRewards.lastActiveDate, today)
    let newStreak = currentRewards.currentStreak
    let newLongestStreak = currentRewards.longestStreak

    if (streakResult.isNewDay) {
      if (streakResult.currentStreak === 1 && currentRewards.lastActiveDate) {
        // Check if it's a consecutive day (within 24-48 hours)
        const lastActive = new Date(currentRewards.lastActiveDate)
        const todayDate = new Date(today)
        const diffDays = Math.floor((todayDate.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDays === 1) {
          // Consecutive day - increment
          newStreak = currentRewards.currentStreak + 1
        } else {
          // Gap - reset
          newStreak = 1
        }
      } else if (!currentRewards.lastActiveDate) {
        // First activity ever
        newStreak = 1
      }

      // Update longest streak if current exceeds it
      if (newStreak > newLongestStreak) {
        newLongestStreak = newStreak
      }
    }

    // Calculate level based on actual stored points (totalPoints is a formula field)
    // We don't calculate levelUp because points from habits/milestones don't persist to the formula
    // The formula only counts method usage, so level changes only happen when methods are completed
    const currentLevel = calculateLevel(currentRewards.totalPoints)

    // Build milestones list for badge checks
    const milestonesReached: number[] = []
    if (body.activityType === "programMilestone" && body.milestone) {
      milestonesReached.push(body.milestone)
    }

    // Check for new badges
    const stats: Stats = {
      methodsCompleted: body.methodsCompleted ?? 0,
      habitsCompleted: body.habitsCompleted ?? 0,
      habitDaysCompleted: body.habitDaysCompleted ?? 0,
      programsCompleted: body.programsCompleted ?? 0,
      longestStreak: newLongestStreak,
      milestonesReached
    }
    const newBadges = checkNewBadges(currentRewards.badges, stats)
    const allBadges = [...currentRewards.badges, ...newBadges]

    // Check for streak milestone badges
    let streakBonusPoints = 0
    if (newStreak === 7 && currentRewards.currentStreak < 7) {
      streakBonusPoints += POINTS.streakWeek
    }
    if (newStreak === 30 && currentRewards.currentStreak < 30) {
      streakBonusPoints += POINTS.streakMonth
    }

    // Note: finalTotal is only used for display, not for actual level calculation
    // since totalPoints is a formula field in Airtable that only counts method usage
    const finalTotal = newTotal + streakBonusPoints

    // Build update fields (totalPoints is now a formula field in Airtable)
    const updateFields: Record<string, unknown> = {
      [USER_FIELDS.badges]: JSON.stringify(allBadges)
    }

    // Only update streak fields if it's a new day
    if (streakResult.isNewDay) {
      updateFields[USER_FIELDS.currentStreak] = newStreak
      updateFields[USER_FIELDS.longestStreak] = newLongestStreak
      updateFields[USER_FIELDS.lastActiveDate] = today
    }

    // Update user record
    await base(tables.users).update(payload.userId, updateFields)

    // If this is a program milestone, update the program's milestonesAwarded field
    if (body.activityType === "programMilestone" && body.programId && body.milestone) {
      try {
        // Fetch current program milestones
        const programRecords = await base(tables.programs)
          .select({
            filterByFormula: `RECORD_ID() = "${body.programId}"`,
            maxRecords: 1,
            returnFieldsByFieldId: true
          })
          .firstPage()

        if (programRecords.length > 0) {
          const programFields = programRecords[0].fields as Record<string, unknown>
          let currentMilestones: string[] = []
          const milestonesField = programFields[PROGRAM_FIELDS.milestonesAwarded]
          if (milestonesField) {
            try {
              currentMilestones = typeof milestonesField === 'string'
                ? JSON.parse(milestonesField)
                : milestonesField
            } catch {
              currentMilestones = []
            }
          }

          // Add new milestone if not already present
          const milestoneStr = String(body.milestone)
          if (!currentMilestones.includes(milestoneStr)) {
            currentMilestones.push(milestoneStr)
            await base(tables.programs).update(body.programId, {
              [PROGRAM_FIELDS.milestonesAwarded]: JSON.stringify(currentMilestones)
            })
          }
        }
      } catch (programErr) {
        console.error("Failed to update program milestones:", programErr)
        // Non-critical - don't fail the request
      }
    }

    return sendSuccess(res, {
      pointsAwarded: pointsAwarded + streakBonusPoints,
      newTotal: finalTotal,
      newBadges,
      // Level is based on totalPoints formula field which only counts method usage
      // Non-method activities (milestones, habits, streaks) don't affect the formula
      // so we never claim levelUp for those - the level display comes from Airtable
      levelUp: false,
      newLevel: currentLevel,
      currentStreak: streakResult.isNewDay ? newStreak : currentRewards.currentStreak,
      longestStreak: newLongestStreak,
      // Include milestone info if this was a milestone award
      milestone: body.activityType === "programMilestone" ? body.milestone : undefined
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
