import { base, tables } from "../airtable.js"
import { PROGRAM_FIELDS } from "../field-mappings.js"
import { isPostgresConfigured } from "../db/client.js"
import { enqueueSyncEvent } from "../sync/outbox.js"
import { getUserRewardStats, updateUserRewardFields, getScheduledSessionStreak } from "../repos/user-repo.js"
import { diffIsoDays, getTodayLocalDate, normalizeDateString } from "./date-utils.js"
import { getProgramByAnyId } from "../repos/program-repo.js"
import { isAirtableRecordId } from "../db/id-utils.js"

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

export type RewardActivityType =
  | "method"
  | "habit"
  | "program"
  | "sessionBonus"
  | "habitDayBonus"
  | "programMilestone"
  | "overtuiging"
  | "personalGoal"

interface BadgeCheckContext {
  counts: RewardCounts
  state: RewardState
  nextLevel: number
}

const BADGE_CHECKS: Record<string, { check: (ctx: BadgeCheckContext) => boolean }> = {
  // Tier 1: Eerste Stappen
  eerste_sessie: { check: (ctx) => ctx.counts.methodCount >= 1 },
  eerste_streak: { check: (ctx) => ctx.state.currentStreak >= 3 },
  eerste_week: { check: (ctx) => ctx.counts.methodCount >= 5 },
  goede_start: { check: (ctx) => ctx.counts.habitCount >= 1 || ctx.counts.personalGoalCount >= 1 },
  // Tier 2: Consistentie
  op_dreef: { check: (ctx) => ctx.state.currentStreak >= 21 },
  tweede_programma: { check: (ctx) => ctx.counts.programsStarted >= 2 },
  drie_maanden: { check: (ctx) => ctx.counts.monthsActive >= 3 },
  veelzijdig: { check: (ctx) => ctx.counts.habitCount >= 1 && ctx.counts.personalGoalCount >= 1 && ctx.counts.methodCount >= 1 },
  // Tier 3: Mentale Atleet
  programma_voltooid: { check: (ctx) => ctx.counts.programsCompleted >= 1 },
  zes_maanden: { check: (ctx) => ctx.counts.monthsActive >= 6 },
  jaar_actief: { check: (ctx) => ctx.counts.monthsActive >= 12 },
  mentale_atleet: { check: (ctx) => ctx.nextLevel >= 8 }
}

interface RewardCounts {
  methodCount: number
  methodPointsSum: number
  habitCount: number
  personalGoalCount: number
  overtuigingCount: number
  habitDaysCount: number
  programsCompleted: number
  monthsActive: number
  programsStarted: number
}

interface RewardState {
  totalPoints: number
  bonusPoints: number
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  badges: string[]
  level: number
}

export interface AwardRewardInput {
  userId: string
  activityType: RewardActivityType
  activityDate?: string
  milestone?: number
  programId?: string
}

export interface AwardRewardResult {
  pointsAwarded: number
  newTotal: number
  newBadges: string[]
  levelUp: boolean
  newLevel: number
  currentStreak: number
  longestStreak: number
  milestone?: number
}

function calculateLevel(points: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].points) {
      return LEVELS[i].level
    }
  }
  return 1
}

function checkNewBadges(existingBadges: string[], ctx: BadgeCheckContext): string[] {
  const added: string[] = []
  for (const [badgeId, badge] of Object.entries(BADGE_CHECKS)) {
    if (!existingBadges.includes(badgeId) && badge.check(ctx)) {
      added.push(badgeId)
    }
  }
  return added
}

function computeStreak(input: {
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  activityDate: string
}): { currentStreak: number; longestStreak: number; lastActiveDate: string | null; streakUpdated: boolean } {
  const lastActive = normalizeDateString(input.lastActiveDate)
  const activityDate = normalizeDateString(input.activityDate)
  if (!activityDate) {
    return {
      currentStreak: input.currentStreak,
      longestStreak: input.longestStreak,
      lastActiveDate: lastActive,
      streakUpdated: false
    }
  }

  if (!lastActive) {
    return {
      currentStreak: 1,
      longestStreak: Math.max(input.longestStreak, 1),
      lastActiveDate: activityDate,
      streakUpdated: true
    }
  }

  const diff = diffIsoDays(lastActive, activityDate)
  if (diff === null || diff < 0) {
    return {
      currentStreak: input.currentStreak,
      longestStreak: input.longestStreak,
      lastActiveDate: lastActive,
      streakUpdated: false
    }
  }

  if (diff === 0) {
    return {
      currentStreak: input.currentStreak,
      longestStreak: input.longestStreak,
      lastActiveDate: lastActive,
      streakUpdated: false
    }
  }

  if (diff === 1) {
    const nextCurrent = input.currentStreak + 1
    return {
      currentStreak: nextCurrent,
      longestStreak: Math.max(input.longestStreak, nextCurrent),
      lastActiveDate: activityDate,
      streakUpdated: true
    }
  }

  return {
    currentStreak: 1,
    longestStreak: Math.max(input.longestStreak, 1),
    lastActiveDate: activityDate,
    streakUpdated: true
  }
}

function calculateBonusAward(input: {
  activityType: RewardActivityType
  milestone?: number
  previousStreak: number
  newStreak: number
}): number {
  let awarded = 0

  if (input.activityType === "overtuiging") {
    awarded += 1
  }

  // Program completion bonus
  if (input.activityType === "programMilestone" && input.milestone === 100) {
    awarded += 100
  }

  // Streak bonuses (program-aligned)
  if (input.newStreak >= 7 && input.previousStreak < 7) {
    awarded += 25
  }
  if (input.newStreak >= 21 && input.previousStreak < 21) {
    awarded += 75
  }

  return awarded
}

function toBaseTotalPoints(counts: RewardCounts): number {
  return (counts.methodPointsSum) + (counts.habitCount * 5) + (counts.personalGoalCount * 5)
}

function parseBadgesField(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string")
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === "string")
      }
    } catch {
      return []
    }
  }
  return []
}

async function updateProgramMilestoneAirtable(programId: string, milestone: number): Promise<void> {
  const records = await base(tables.programs)
    .select({
      filterByFormula: `RECORD_ID() = "${programId}"`,
      maxRecords: 1,
      returnFieldsByFieldId: true
    })
    .firstPage()

  if (records.length === 0) return

  const fields = records[0].fields as Record<string, unknown>
  let milestones: string[] = []
  const existing = fields[PROGRAM_FIELDS.milestonesAwarded]
  if (existing) {
    try {
      milestones = typeof existing === "string"
        ? JSON.parse(existing)
        : (Array.isArray(existing) ? existing as string[] : [])
    } catch {
      milestones = []
    }
  }

  const target = String(milestone)
  if (milestones.includes(target)) return
  milestones.push(target)

  await base(tables.programs).update(programId, {
    [PROGRAM_FIELDS.milestonesAwarded]: JSON.stringify(milestones)
  })
}

async function resolveProgramAirtableId(programId: string, userId: string): Promise<string | null> {
  if (isAirtableRecordId(programId)) {
    return programId
  }
  if (!isPostgresConfigured()) {
    return null
  }
  const program = await getProgramByAnyId(programId, userId)
  if (program?.airtableRecordId && isAirtableRecordId(program.airtableRecordId)) {
    return program.airtableRecordId
  }
  return null
}

async function getProgramMilestonesAirtable(programId: string): Promise<string[]> {
  const records = await base(tables.programs)
    .select({
      filterByFormula: `RECORD_ID() = "${programId}"`,
      maxRecords: 1,
      returnFieldsByFieldId: true
    })
    .firstPage()
  if (records.length === 0) return []
  const fields = records[0].fields as Record<string, unknown>
  return parseBadgesField(fields[PROGRAM_FIELDS.milestonesAwarded])
}

function buildAwardResult(input: {
  state: RewardState
  counts: RewardCounts
  activityType: RewardActivityType
  activityDate: string
  milestone?: number
  precomputedStreak?: { currentStreak: number; longestStreak: number }
}): {
  nextState: RewardState
  result: AwardRewardResult
} {
  const streak = input.precomputedStreak
    ? {
        currentStreak: input.precomputedStreak.currentStreak,
        longestStreak: input.precomputedStreak.longestStreak,
        lastActiveDate: input.state.lastActiveDate,
        streakUpdated: true
      }
    : computeStreak({
        currentStreak: input.state.currentStreak,
        longestStreak: input.state.longestStreak,
        lastActiveDate: input.state.lastActiveDate,
        activityDate: input.activityDate
      })

  const bonusAwarded = calculateBonusAward({
    activityType: input.activityType,
    milestone: input.milestone,
    previousStreak: input.state.currentStreak,
    newStreak: streak.currentStreak
  })

  const newBonusPoints = input.state.bonusPoints + bonusAwarded
  const currentTotal = toBaseTotalPoints(input.counts) + input.state.bonusPoints
  const newTotal = toBaseTotalPoints(input.counts) + newBonusPoints

  const currentLevel = calculateLevel(currentTotal)
  const nextLevel = calculateLevel(newTotal)
  const levelUp = nextLevel > currentLevel

  const badgeCtx: BadgeCheckContext = {
    counts: input.counts,
    state: {
      ...input.state,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak
    },
    nextLevel
  }

  const newBadges = checkNewBadges(input.state.badges, badgeCtx)
  const allBadges = [...input.state.badges, ...newBadges]

  const nextState: RewardState = {
    totalPoints: newTotal,
    bonusPoints: newBonusPoints,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastActiveDate: streak.lastActiveDate,
    badges: allBadges,
    level: levelUp ? nextLevel : input.state.level
  }

  return {
    nextState,
    result: {
      pointsAwarded: bonusAwarded,
      newTotal,
      newBadges,
      levelUp,
      newLevel: nextState.level,
      currentStreak: nextState.currentStreak,
      longestStreak: nextState.longestStreak,
      milestone: input.activityType === "programMilestone" ? input.milestone : undefined
    }
  }
}

async function awardPostgres(input: AwardRewardInput): Promise<AwardRewardResult> {
  const stats = await getUserRewardStats(input.userId)
  if (!stats) {
    throw new Error("User not found")
  }

  let badges: string[] = []
  try {
    badges = parseBadgesField(stats.user.badges)
  } catch {
    badges = []
  }

  const activityDate = normalizeDateString(input.activityDate) || getTodayLocalDate()

  const programStreak = await getScheduledSessionStreak(input.userId)
  const longestStreak = Math.max(stats.user.longestStreak, programStreak)

  const state: RewardState = {
    totalPoints: toBaseTotalPoints(stats),
    bonusPoints: stats.user.bonusPoints ?? 0,
    currentStreak: programStreak,
    longestStreak,
    lastActiveDate: normalizeDateString(stats.user.lastActiveDate),
    badges,
    level: stats.user.level ?? 0
  }

  let milestone = input.milestone
  let programAirtableId: string | null = null
  if (input.activityType === "programMilestone" && input.programId && input.milestone) {
    programAirtableId = await resolveProgramAirtableId(input.programId, input.userId)
    if (programAirtableId) {
      const alreadyAwarded = await getProgramMilestonesAirtable(programAirtableId)
      if (alreadyAwarded.includes(String(input.milestone))) {
        milestone = undefined
      }
    }
  }

  const { nextState, result } = buildAwardResult({
    state,
    counts: stats,
    activityType: input.activityType,
    activityDate,
    milestone,
    precomputedStreak: { currentStreak: programStreak, longestStreak }
  })

  nextState.lastActiveDate = activityDate

  const mentalFitnessScore = stats.methodPointsSum + nextState.bonusPoints
  const personalGoalsScore = stats.personalGoalCount * 5
  const goodHabitsScore = stats.habitCount * 5
  const totalPoints = mentalFitnessScore + personalGoalsScore + goodHabitsScore

  await updateUserRewardFields({
    userId: input.userId,
    bonusPoints: nextState.bonusPoints,
    currentStreak: nextState.currentStreak,
    longestStreak: nextState.longestStreak,
    lastActiveDate: nextState.lastActiveDate,
    badges: nextState.badges,
    level: nextState.level,
    totalPoints,
    mentalFitnessScore,
    personalGoalsScore,
    goodHabitsScore
  })

  await enqueueSyncEvent({
    eventType: "upsert",
    entityType: "user",
    entityId: input.userId,
    payload: {
      userId: input.userId,
      currentStreak: nextState.currentStreak,
      longestStreak: nextState.longestStreak,
      lastActiveDate: nextState.lastActiveDate,
      bonusPoints: nextState.bonusPoints,
      badges: JSON.stringify(nextState.badges),
      level: nextState.level,
      totalPoints,
      mentalFitnessScore,
      personalGoalsScore,
      goodHabitsScore
    },
    priority: 10
  })

  if (input.activityType === "programMilestone" && milestone && programAirtableId) {
    await updateProgramMilestoneAirtable(programAirtableId, milestone)
  }

  return result
}

export async function awardRewardActivity(input: AwardRewardInput): Promise<AwardRewardResult> {
  return awardPostgres(input)
}
