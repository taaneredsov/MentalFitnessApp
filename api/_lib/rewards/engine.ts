import { base, tables } from "../airtable.js"
import {
  METHOD_USAGE_FIELDS,
  HABIT_USAGE_FIELDS,
  PERSONAL_GOAL_USAGE_FIELDS,
  OVERTUIGING_USAGE_FIELDS,
  PROGRAM_FIELDS,
  USER_FIELDS,
  transformUserRewards
} from "../field-mappings.js"
import { getDataBackendMode } from "../data-backend.js"
import { isPostgresConfigured } from "../db/client.js"
import { enqueueSyncEvent } from "../sync/outbox.js"
import { getUserRewardStats, updateUserRewardFields } from "../repos/user-repo.js"
import { diffIsoDays, getTodayLocalDate, normalizeDateString } from "./date-utils.js"
import { getProgramByAnyId } from "../repos/program-repo.js"
import { isAirtableRecordId } from "../db/id-utils.js"

const REWARD_BACKEND_ENVS = [
  "DATA_BACKEND_REWARDS",
  "DATA_BACKEND_METHOD_USAGE",
  "DATA_BACKEND_HABIT_USAGE",
  "DATA_BACKEND_PERSONAL_GOAL_USAGE",
  "DATA_BACKEND_OVERTUIGING_USAGE"
] as const

const LEVELS = [
  { level: 1, points: 0 },
  { level: 2, points: 50 },
  { level: 3, points: 150 },
  { level: 4, points: 350 },
  { level: 5, points: 600 },
  { level: 6, points: 1000 },
  { level: 7, points: 1500 },
  { level: 8, points: 2500 },
  { level: 9, points: 4000 },
  { level: 10, points: 6000 }
] as const

const MILESTONE_POINTS: Record<number, number> = {
  25: 25,
  50: 50,
  75: 75,
  100: 100
}

export type RewardActivityType =
  | "method"
  | "habit"
  | "program"
  | "sessionBonus"
  | "habitDayBonus"
  | "programMilestone"
  | "overtuiging"
  | "personalGoal"

interface RewardBadgeStats {
  methodsCompleted: number
  habitsCompleted: number
  habitDaysCompleted: number
  programsCompleted: number
  longestStreak: number
  milestonesReached: number[]
}

const BADGE_CHECKS = {
  eerste_sessie: { check: (stats: RewardBadgeStats) => stats.methodsCompleted >= 1 },
  vijf_methodes: { check: (stats: RewardBadgeStats) => stats.methodsCompleted >= 5 },
  twintig_methodes: { check: (stats: RewardBadgeStats) => stats.methodsCompleted >= 20 },
  eerste_programma: { check: (stats: RewardBadgeStats) => stats.programsCompleted >= 1 || stats.milestonesReached.includes(100) },
  kwart_programma: { check: (stats: RewardBadgeStats) => stats.milestonesReached.includes(25) },
  half_programma: { check: (stats: RewardBadgeStats) => stats.milestonesReached.includes(50) },
  driekwart_programma: { check: (stats: RewardBadgeStats) => stats.milestonesReached.includes(75) },
  week_streak: { check: (stats: RewardBadgeStats) => stats.longestStreak >= 7 },
  twee_weken_streak: { check: (stats: RewardBadgeStats) => stats.longestStreak >= 14 },
  maand_streak: { check: (stats: RewardBadgeStats) => stats.longestStreak >= 30 },
  goede_start: { check: (stats: RewardBadgeStats) => stats.habitsCompleted >= 1 },
  dagelijkse_held: { check: (stats: RewardBadgeStats) => stats.habitDaysCompleted >= 1 },
  week_gewoontes: { check: (stats: RewardBadgeStats) => stats.habitDaysCompleted >= 7 }
} as const

interface RewardCounts {
  methodCount: number
  habitCount: number
  personalGoalCount: number
  overtuigingCount: number
  habitDaysCount: number
  programsCompleted: number
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
  forcePostgres?: boolean
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

function checkNewBadges(existingBadges: string[], stats: RewardBadgeStats): string[] {
  const added: string[] = []
  for (const [badgeId, badge] of Object.entries(BADGE_CHECKS)) {
    if (!existingBadges.includes(badgeId) && badge.check(stats)) {
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

  if (input.activityType === "programMilestone" && input.milestone) {
    awarded += MILESTONE_POINTS[input.milestone] || 0
  }

  if (input.activityType === "overtuiging") {
    awarded += 1
  }

  if (input.newStreak === 7 && input.previousStreak < 7) {
    awarded += 50
  }
  if (input.newStreak === 30 && input.previousStreak < 30) {
    awarded += 200
  }

  return awarded
}

function toBaseTotalPoints(counts: RewardCounts): number {
  return (counts.methodCount * 10) + (counts.habitCount * 5)
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

async function getAirtableRewardStateAndCounts(userId: string): Promise<{ state: RewardState; counts: RewardCounts }> {
  const userRecords = await base(tables.users)
    .select({
      filterByFormula: `RECORD_ID() = "${userId}"`,
      maxRecords: 1,
      returnFieldsByFieldId: true
    })
    .firstPage()

  if (userRecords.length === 0) {
    throw new Error("User not found")
  }

  const transformed = transformUserRewards(userRecords[0] as { id: string; fields: Record<string, unknown> }) as RewardState
  const state: RewardState = {
    totalPoints: Number(transformed.totalPoints || 0),
    bonusPoints: Number(transformed.bonusPoints || 0),
    currentStreak: Number(transformed.currentStreak || 0),
    longestStreak: Number(transformed.longestStreak || 0),
    lastActiveDate: normalizeDateString(transformed.lastActiveDate),
    badges: Array.isArray(transformed.badges) ? transformed.badges : [],
    level: Number(transformed.level || 1)
  }

  const [methodUsageRecords, habitUsageRecords, personalGoalUsageRecords, overtuigingUsageRecords, programRecords] = await Promise.all([
    base(tables.methodUsage).select({ returnFieldsByFieldId: true }).all(),
    base(tables.habitUsage).select({ returnFieldsByFieldId: true }).all(),
    base(tables.personalGoalUsage).select({ returnFieldsByFieldId: true }).all(),
    base(tables.overtuigingenGebruik).select({ returnFieldsByFieldId: true }).all(),
    base(tables.programs).select({ returnFieldsByFieldId: true }).all()
  ])

  const methodCount = methodUsageRecords.filter((record) => {
    const field = (record.fields as Record<string, unknown>)[METHOD_USAGE_FIELDS.user] as string[] | undefined
    return field?.includes(userId)
  }).length

  const userHabitRecords = habitUsageRecords.filter((record) => {
    const field = (record.fields as Record<string, unknown>)[HABIT_USAGE_FIELDS.user] as string[] | undefined
    return field?.includes(userId)
  })
  const habitCount = userHabitRecords.length
  const habitDays = new Set(
    userHabitRecords
      .map((record) => normalizeDateString((record.fields as Record<string, unknown>)[HABIT_USAGE_FIELDS.date] as string | undefined))
      .filter((value): value is string => !!value)
  )

  const personalGoalCount = personalGoalUsageRecords.filter((record) => {
    const field = (record.fields as Record<string, unknown>)[PERSONAL_GOAL_USAGE_FIELDS.user] as string[] | undefined
    return field?.includes(userId)
  }).length

  const overtuigingCount = overtuigingUsageRecords.filter((record) => {
    const field = (record.fields as Record<string, unknown>)[OVERTUIGING_USAGE_FIELDS.user] as string[] | undefined
    return field?.includes(userId)
  }).length

  const programsCompleted = programRecords.filter((record) => {
    const fields = record.fields as Record<string, unknown>
    const userField = fields[PROGRAM_FIELDS.user] as string[] | undefined
    const status = fields[PROGRAM_FIELDS.status] as string | undefined
    return userField?.includes(userId) && status === "Afgewerkt"
  }).length

  return {
    state,
    counts: {
      methodCount,
      habitCount,
      personalGoalCount,
      overtuigingCount,
      habitDaysCount: habitDays.size,
      programsCompleted
    }
  }
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
}): {
  nextState: RewardState
  result: AwardRewardResult
} {
  const streak = computeStreak({
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

  const milestonesReached = input.activityType === "programMilestone" && input.milestone
    ? [input.milestone]
    : []

  const stats: RewardBadgeStats = {
    methodsCompleted: input.counts.methodCount,
    habitsCompleted: input.counts.habitCount,
    habitDaysCompleted: input.counts.habitDaysCount,
    programsCompleted: input.counts.programsCompleted,
    longestStreak: streak.longestStreak,
    milestonesReached
  }

  const newBadges = checkNewBadges(input.state.badges, stats)
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
  const state: RewardState = {
    totalPoints: toBaseTotalPoints(stats),
    bonusPoints: stats.user.bonusPoints,
    currentStreak: stats.user.currentStreak,
    longestStreak: stats.user.longestStreak,
    lastActiveDate: normalizeDateString(stats.user.lastActiveDate),
    badges,
    level: stats.user.level
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
    milestone
  })

  await updateUserRewardFields({
    userId: input.userId,
    bonusPoints: nextState.bonusPoints,
    currentStreak: nextState.currentStreak,
    longestStreak: nextState.longestStreak,
    lastActiveDate: nextState.lastActiveDate,
    badges: nextState.badges,
    level: nextState.level
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
      level: nextState.level
    },
    priority: 10
  })

  if (input.activityType === "programMilestone" && milestone && programAirtableId) {
    await updateProgramMilestoneAirtable(programAirtableId, milestone)
  }

  return result
}

async function awardAirtable(input: AwardRewardInput): Promise<AwardRewardResult> {
  const { state, counts } = await getAirtableRewardStateAndCounts(input.userId)
  const activityDate = normalizeDateString(input.activityDate) || getTodayLocalDate()

  let milestone = input.milestone
  let resolvedProgramId: string | null = null
  if (input.activityType === "programMilestone" && input.programId && input.milestone) {
    resolvedProgramId = await resolveProgramAirtableId(input.programId, input.userId)
    if (resolvedProgramId) {
      const alreadyAwarded = await getProgramMilestonesAirtable(resolvedProgramId)
      if (alreadyAwarded.includes(String(input.milestone))) {
        milestone = undefined
      }
    }
  }

  const { nextState, result } = buildAwardResult({
    state,
    counts,
    activityType: input.activityType,
    activityDate,
    milestone
  })

  await base(tables.users).update(input.userId, {
    [USER_FIELDS.badges]: JSON.stringify(nextState.badges),
    [USER_FIELDS.bonusPoints]: nextState.bonusPoints,
    [USER_FIELDS.currentStreak]: nextState.currentStreak,
    [USER_FIELDS.longestStreak]: nextState.longestStreak,
    [USER_FIELDS.lastActiveDate]: nextState.lastActiveDate,
    [USER_FIELDS.level]: nextState.level
  })

  if (input.activityType === "programMilestone" && resolvedProgramId && milestone) {
    await updateProgramMilestoneAirtable(resolvedProgramId, milestone)
  }

  return result
}

export function shouldUsePostgresRewards(forcePostgres = false): boolean {
  if (!isPostgresConfigured()) return false
  if (forcePostgres) return true
  return REWARD_BACKEND_ENVS.some((envKey) => getDataBackendMode(envKey) === "postgres_primary")
}

export async function awardRewardActivity(input: AwardRewardInput): Promise<AwardRewardResult> {
  if (shouldUsePostgresRewards(input.forcePostgres)) {
    return awardPostgres(input)
  }
  return awardAirtable(input)
}
