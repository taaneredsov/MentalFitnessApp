/**
 * Backfill script for Rewards v2
 *
 * For each user:
 * 1. Recalculates mentalFitnessScore from actual method pointsValue sums
 * 2. Recalculates personalGoalsScore, goodHabitsScore from counts
 * 3. Recalculates totalPoints from new formulas
 * 4. Recalculates level from new thresholds (0-2000)
 * 5. Resets currentStreak to 0 (new program-aligned model)
 * 6. Preserves longestStreak, bonusPoints, lastActiveDate
 * 7. Awards any new badges the user qualifies for
 *
 * Usage:
 *   npx tsx scripts/backfill-rewards-v2.ts [--dry-run] [--user-id=<id>]
 */

import { dbQuery } from "../api/_lib/db/client.js"
import { getUserRewardStats, updateUserRewardFields } from "../api/_lib/repos/user-repo.js"

const LEVELS = [
  { level: 1, points: 0 },
  { level: 2, points: 50 },
  { level: 3, points: 125 },
  { level: 4, points: 250 },
  { level: 5, points: 400 },
  { level: 6, points: 600 },
  { level: 7, points: 850 },
  { level: 8, points: 1150 },
  { level: 9, points: 1500 },
  { level: 10, points: 2000 }
] as const

interface BadgeCtx {
  methodCount: number
  habitCount: number
  personalGoalCount: number
  programsCompleted: number
  programsStarted: number
  monthsActive: number
  currentStreak: number
  nextLevel: number
}

const BADGE_CHECKS: Record<string, (ctx: BadgeCtx) => boolean> = {
  eerste_sessie: (ctx) => ctx.methodCount >= 1,
  eerste_streak: (ctx) => ctx.currentStreak >= 3,
  eerste_week: (ctx) => ctx.methodCount >= 5,
  goede_start: (ctx) => ctx.habitCount >= 1 || ctx.personalGoalCount >= 1,
  op_dreef: (ctx) => ctx.currentStreak >= 21,
  tweede_programma: (ctx) => ctx.programsStarted >= 2,
  drie_maanden: (ctx) => ctx.monthsActive >= 3,
  veelzijdig: (ctx) => ctx.habitCount >= 1 && ctx.personalGoalCount >= 1 && ctx.methodCount >= 1,
  programma_voltooid: (ctx) => ctx.programsCompleted >= 1,
  zes_maanden: (ctx) => ctx.monthsActive >= 6,
  jaar_actief: (ctx) => ctx.monthsActive >= 12,
  mentale_atleet: (ctx) => ctx.nextLevel >= 8
}

function calculateLevel(points: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].points) return LEVELS[i].level
  }
  return 1
}

function parseBadges(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((b: unknown) => typeof b === "string") : []
  } catch {
    return []
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const userIdArg = args.find((a) => a.startsWith("--user-id="))?.split("=")[1]

  console.log(`[backfill-rewards-v2] ${dryRun ? "DRY RUN" : "LIVE RUN"}`)

  const usersResult = userIdArg
    ? await dbQuery<{ id: string }>(`SELECT id FROM users_pg WHERE id = $1`, [userIdArg])
    : await dbQuery<{ id: string }>(`SELECT id FROM users_pg WHERE status = 'active' ORDER BY id`)

  const users = usersResult.rows
  console.log(`[backfill-rewards-v2] Processing ${users.length} users`)

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const { id: userId } of users) {
    try {
      const stats = await getUserRewardStats(userId)
      if (!stats) {
        console.warn(`  [${userId}] not found, skipping`)
        skipped++
        continue
      }

      const mentalFitnessScore = stats.methodPointsSum + stats.user.bonusPoints
      const personalGoalsScore = stats.personalGoalCount * 5
      const goodHabitsScore = stats.habitCount * 5
      const totalPoints = mentalFitnessScore + personalGoalsScore + goodHabitsScore
      const level = calculateLevel(totalPoints)

      // Badge calculation
      const existingBadges = parseBadges(stats.user.badges)
      const ctx: BadgeCtx = {
        methodCount: stats.methodCount,
        habitCount: stats.habitCount,
        personalGoalCount: stats.personalGoalCount,
        programsCompleted: stats.programsCompleted,
        programsStarted: stats.programsStarted,
        monthsActive: stats.monthsActive,
        currentStreak: 0, // Reset — new program-aligned model
        nextLevel: level
      }

      const newBadges: string[] = []
      for (const [badgeId, check] of Object.entries(BADGE_CHECKS)) {
        if (!existingBadges.includes(badgeId) && check(ctx)) {
          newBadges.push(badgeId)
        }
      }

      const allBadges = [...existingBadges, ...newBadges]

      console.log(
        `  [${userId}] total=${totalPoints} mf=${mentalFitnessScore} pg=${personalGoalsScore} gh=${goodHabitsScore} ` +
        `level=${level} badges=${allBadges.length} (+${newBadges.length} new) streak=0`
      )

      if (!dryRun) {
        await updateUserRewardFields({
          userId,
          bonusPoints: stats.user.bonusPoints,
          currentStreak: 0,
          longestStreak: stats.user.longestStreak,
          lastActiveDate: stats.user.lastActiveDate,
          badges: allBadges,
          level,
          totalPoints,
          mentalFitnessScore,
          personalGoalsScore,
          goodHabitsScore
        })
      }

      updated++
    } catch (err) {
      console.error(`  [${userId}] ERROR:`, err)
      errors++
    }
  }

  console.log(`\n[backfill-rewards-v2] Done: ${updated} updated, ${skipped} skipped, ${errors} errors`)
  process.exit(errors > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("[backfill-rewards-v2] Fatal:", err)
  process.exit(1)
})
