import { base, tables } from "../airtable.js"
import {
  PROGRAM_FIELDS,
  PROGRAMMAPLANNING_FIELDS,
  METHOD_USAGE_FIELDS,
  HABIT_USAGE_FIELDS,
  PERSONAL_GOAL_FIELDS,
  PERSONAL_GOAL_USAGE_FIELDS,
  OVERTUIGING_USAGE_FIELDS,
  PERSOONLIJKE_OVERTUIGING_FIELDS,
  USER_FIELDS
} from "../field-mappings.js"
import { isAirtableRecordId } from "../db/id-utils.js"
import { findAirtableId, upsertAirtableIdMap } from "./id-map.js"

export class RetryableSyncError extends Error {}

async function resolveProgramAirtableId(programId: string | null | undefined): Promise<string | null> {
  if (!programId) return null
  if (isAirtableRecordId(programId)) return programId

  const mapped = await findAirtableId("program", programId)
  if (!mapped) {
    throw new RetryableSyncError(`Program mapping missing for ${programId}`)
  }
  return mapped
}

async function upsertProgram(entityId: string, payload: Record<string, unknown>): Promise<void> {
  const existingAirtableId = await findAirtableId("program", entityId)

  const fields: Record<string, unknown> = {
    [PROGRAM_FIELDS.user]: [String(payload.userId)],
    [PROGRAM_FIELDS.startDate]: payload.startDate,
    [PROGRAM_FIELDS.duration]: payload.duration,
    [PROGRAM_FIELDS.status]: payload.status || "Actief",
    [PROGRAM_FIELDS.creationType]: payload.creationType || "Manueel"
  }

  if (payload.daysOfWeek && Array.isArray(payload.daysOfWeek) && payload.daysOfWeek.length > 0) {
    fields[PROGRAM_FIELDS.daysOfWeek] = payload.daysOfWeek
  }
  if (payload.goals && Array.isArray(payload.goals) && payload.goals.length > 0) {
    fields[PROGRAM_FIELDS.goals] = payload.goals
  }
  if (payload.methods && Array.isArray(payload.methods) && payload.methods.length > 0) {
    fields[PROGRAM_FIELDS.methods] = payload.methods
  }
  if (payload.overtuigingen && Array.isArray(payload.overtuigingen) && payload.overtuigingen.length > 0) {
    fields[PROGRAM_FIELDS.overtuigingen] = payload.overtuigingen
  }
  if (payload.notes) {
    fields[PROGRAM_FIELDS.notes] = payload.notes
  }

  if (existingAirtableId) {
    await base(tables.programs).update(existingAirtableId, fields, { typecast: true })
    return
  }

  const record = await base(tables.programs).create(fields, { typecast: true })
  await upsertAirtableIdMap("program", entityId, record.id)
}

async function upsertProgramSchedule(entityId: string, payload: Record<string, unknown>): Promise<void> {
  const existingAirtableId = await findAirtableId("program_schedule", entityId)
  const mappedProgramId = await resolveProgramAirtableId((payload.programId as string | undefined) || null)

  const fields: Record<string, unknown> = {}
  if (mappedProgramId) {
    fields[PROGRAMMAPLANNING_FIELDS.program] = [mappedProgramId]
  }
  if (payload.date) {
    fields[PROGRAMMAPLANNING_FIELDS.date] = payload.date
  }
  if (payload.methods && Array.isArray(payload.methods)) {
    fields[PROGRAMMAPLANNING_FIELDS.methods] = payload.methods
  }
  if (payload.goals && Array.isArray(payload.goals)) {
    fields[PROGRAMMAPLANNING_FIELDS.goals] = payload.goals
  }
  if (payload.notes !== undefined) {
    fields[PROGRAMMAPLANNING_FIELDS.notes] = payload.notes
  }
  if (payload.sessionDescription) {
    fields[PROGRAMMAPLANNING_FIELDS.sessionDescription] = payload.sessionDescription
  }

  if (existingAirtableId) {
    await base(tables.programmaplanning).update(existingAirtableId, fields, { typecast: true })
    return
  }

  if (!mappedProgramId) {
    throw new RetryableSyncError(`Program mapping missing for schedule ${entityId}`)
  }

  const record = await base(tables.programmaplanning).create(fields, { typecast: true })
  await upsertAirtableIdMap("program_schedule", entityId, record.id)
}

async function upsertMethodUsage(entityId: string, payload: Record<string, unknown>): Promise<void> {
  const existingAirtableId = await findAirtableId("method_usage", entityId)
  const mappedProgramId = await resolveProgramAirtableId((payload.programId as string | undefined) || null)

  const fields: Record<string, unknown> = {
    [METHOD_USAGE_FIELDS.user]: [String(payload.userId)],
    [METHOD_USAGE_FIELDS.method]: [String(payload.methodId)],
    [METHOD_USAGE_FIELDS.usedAt]: payload.usedAt
  }

  if (payload.programScheduleId) {
    fields[METHOD_USAGE_FIELDS.programmaplanning] = [String(payload.programScheduleId)]
  } else if (mappedProgramId) {
    fields[METHOD_USAGE_FIELDS.program] = [mappedProgramId]
  }
  if (payload.remark) {
    fields[METHOD_USAGE_FIELDS.remark] = String(payload.remark)
  }

  if (existingAirtableId) {
    await base(tables.methodUsage).update(existingAirtableId, fields, { typecast: true })
    return
  }

  const record = await base(tables.methodUsage).create(fields, { typecast: true })
  await upsertAirtableIdMap("method_usage", entityId, record.id)
}

async function upsertHabitUsage(entityId: string, payload: Record<string, unknown>): Promise<void> {
  const existingAirtableId = await findAirtableId("habit_usage", entityId)

  const fields: Record<string, unknown> = {
    [HABIT_USAGE_FIELDS.user]: [String(payload.userId)],
    [HABIT_USAGE_FIELDS.method]: [String(payload.methodId)],
    [HABIT_USAGE_FIELDS.date]: payload.date
  }

  if (existingAirtableId) {
    await base(tables.habitUsage).update(existingAirtableId, fields, { typecast: true })
    return
  }

  const record = await base(tables.habitUsage).create(fields, { typecast: true })
  await upsertAirtableIdMap("habit_usage", entityId, record.id)
}

async function upsertPersonalGoalUsage(entityId: string, payload: Record<string, unknown>): Promise<void> {
  const existingAirtableId = await findAirtableId("personal_goal_usage", entityId)

  const fields: Record<string, unknown> = {
    [PERSONAL_GOAL_USAGE_FIELDS.user]: [String(payload.userId)],
    [PERSONAL_GOAL_USAGE_FIELDS.personalGoal]: [String(payload.personalGoalId)],
    [PERSONAL_GOAL_USAGE_FIELDS.date]: payload.date
  }

  if (existingAirtableId) {
    await base(tables.personalGoalUsage).update(existingAirtableId, fields, { typecast: true })
    return
  }

  const record = await base(tables.personalGoalUsage).create(fields, { typecast: true })
  await upsertAirtableIdMap("personal_goal_usage", entityId, record.id)
}

async function upsertOvertuigingUsage(entityId: string, payload: Record<string, unknown>): Promise<void> {
  const existingAirtableId = await findAirtableId("overtuiging_usage", entityId)

  const fields: Record<string, unknown> = {
    [OVERTUIGING_USAGE_FIELDS.user]: [String(payload.userId)],
    [OVERTUIGING_USAGE_FIELDS.overtuiging]: [String(payload.overtuigingId)],
    [OVERTUIGING_USAGE_FIELDS.date]: payload.date
  }

  if (payload.programId) {
    fields[OVERTUIGING_USAGE_FIELDS.program] = [String(payload.programId)]
  }

  if (existingAirtableId) {
    await base(tables.overtuigingenGebruik).update(existingAirtableId, fields, { typecast: true })
    return
  }

  const record = await base(tables.overtuigingenGebruik).create(fields, { typecast: true })
  await upsertAirtableIdMap("overtuiging_usage", entityId, record.id)
}

async function upsertPersonalGoal(entityId: string, payload: Record<string, unknown>): Promise<void> {
  const existingAirtableId = await findAirtableId("personal_goal", entityId)

  const fields: Record<string, unknown> = {}

  // Always set user link
  if (payload.userId) fields[PERSONAL_GOAL_FIELDS.user] = [String(payload.userId)]

  // Only set fields that are present in the payload (partial update safe)
  if (payload.name !== undefined) fields[PERSONAL_GOAL_FIELDS.name] = String(payload.name)
  if (payload.status !== undefined) fields[PERSONAL_GOAL_FIELDS.status] = String(payload.status)
  if (payload.description !== undefined) fields[PERSONAL_GOAL_FIELDS.description] = String(payload.description)

  if (payload.scheduleDays !== undefined) {
    if (Array.isArray(payload.scheduleDays) && payload.scheduleDays.length > 0) {
      fields[PERSONAL_GOAL_FIELDS.scheduleDays] = (payload.scheduleDays as string[]).join(", ")
    } else {
      // Clear the field when scheduleDays is null or empty array
      fields[PERSONAL_GOAL_FIELDS.scheduleDays] = ""
    }
  }

  // For creates, ensure required defaults
  if (!existingAirtableId) {
    if (!fields[PERSONAL_GOAL_FIELDS.name]) fields[PERSONAL_GOAL_FIELDS.name] = "Persoonlijk doel"
    if (!fields[PERSONAL_GOAL_FIELDS.status]) fields[PERSONAL_GOAL_FIELDS.status] = "Actief"
  }

  if (existingAirtableId) {
    await base(tables.personalGoals).update(existingAirtableId, fields, { typecast: true })
    return
  }

  const record = await base(tables.personalGoals).create(fields, { typecast: true })
  await upsertAirtableIdMap("personal_goal", entityId, record.id)
}

async function upsertPersoonlijkeOvertuiging(entityId: string, payload: Record<string, unknown>): Promise<void> {
  const existingAirtableId = await findAirtableId("persoonlijke_overtuiging", entityId)

  const fields: Record<string, unknown> = {}

  // Always set user link
  if (payload.userId) fields[PERSOONLIJKE_OVERTUIGING_FIELDS.user] = [String(payload.userId)]

  // Only set fields that are present in the payload (partial update safe)
  if (payload.name !== undefined) fields[PERSOONLIJKE_OVERTUIGING_FIELDS.name] = String(payload.name)
  if (payload.status !== undefined) fields[PERSOONLIJKE_OVERTUIGING_FIELDS.status] = String(payload.status)
  if (payload.completedDate !== undefined) {
    fields[PERSOONLIJKE_OVERTUIGING_FIELDS.completedDate] = payload.completedDate || null
  }

  // Resolve program ID from Postgres UUID to Airtable record ID
  if (payload.programId) {
    const programAirtableId = await resolveProgramAirtableId(String(payload.programId))
    if (programAirtableId) {
      fields[PERSOONLIJKE_OVERTUIGING_FIELDS.program] = [programAirtableId]
    }
  }

  // For creates, ensure required defaults
  if (!existingAirtableId) {
    if (!fields[PERSOONLIJKE_OVERTUIGING_FIELDS.name]) fields[PERSOONLIJKE_OVERTUIGING_FIELDS.name] = ""
    if (!fields[PERSOONLIJKE_OVERTUIGING_FIELDS.status]) fields[PERSOONLIJKE_OVERTUIGING_FIELDS.status] = "Actief"
  }

  if (existingAirtableId) {
    await base(tables.persoonlijkeOvertuigingen).update(existingAirtableId, fields, { typecast: true })
    return
  }

  const record = await base(tables.persoonlijkeOvertuigingen).create(fields, { typecast: true })
  await upsertAirtableIdMap("persoonlijke_overtuiging", entityId, record.id)
}

async function upsertUser(_entityId: string, payload: Record<string, unknown>): Promise<void> {
  const userId = String(payload.userId)
  if (!isAirtableRecordId(userId)) {
    throw new RetryableSyncError(`User sync expects Airtable user ID, got ${userId}`)
  }

  const fields: Record<string, unknown> = {}
  if (payload.currentStreak !== undefined) fields[USER_FIELDS.currentStreak] = payload.currentStreak
  if (payload.longestStreak !== undefined) fields[USER_FIELDS.longestStreak] = payload.longestStreak
  if (payload.lastActiveDate !== undefined) fields[USER_FIELDS.lastActiveDate] = payload.lastActiveDate
  if (payload.lastLogin !== undefined) fields[USER_FIELDS.lastLogin] = payload.lastLogin
  if (payload.bonusPoints !== undefined) fields[USER_FIELDS.bonusPoints] = payload.bonusPoints
  if (payload.badges !== undefined) fields[USER_FIELDS.badges] = payload.badges
  if (payload.level !== undefined) fields[USER_FIELDS.level] = payload.level

  if (Object.keys(fields).length === 0) return

  await base(tables.users).update(userId, fields, { typecast: true })
}

async function deleteByEntity(entityType: string, entityId: string): Promise<void> {
  const airtableId = await findAirtableId(entityType, entityId)
  if (!airtableId) return

  if (entityType === "habit_usage") {
    await base(tables.habitUsage).destroy(airtableId)
    return
  }
  if (entityType === "method_usage") {
    await base(tables.methodUsage).destroy(airtableId)
    return
  }
  if (entityType === "personal_goal") {
    await base(tables.personalGoals).destroy(airtableId)
    return
  }
  if (entityType === "personal_goal_usage") {
    await base(tables.personalGoalUsage).destroy(airtableId)
    return
  }
  if (entityType === "overtuiging_usage") {
    await base(tables.overtuigingenGebruik).destroy(airtableId)
    return
  }
  if (entityType === "persoonlijke_overtuiging") {
    await base(tables.persoonlijkeOvertuigingen).destroy(airtableId)
    return
  }
  if (entityType === "program") {
    await base(tables.programs).destroy(airtableId)
    return
  }
  if (entityType === "program_schedule") {
    await base(tables.programmaplanning).destroy(airtableId)
  }
}

export async function writeOutboxEventToAirtable(input: {
  eventType: string
  entityType: string
  entityId: string
  payload: Record<string, unknown>
}): Promise<void> {
  if (input.eventType === "delete") {
    await deleteByEntity(input.entityType, input.entityId)
    return
  }

  switch (input.entityType) {
    case "program":
      await upsertProgram(input.entityId, input.payload)
      return
    case "program_schedule":
      await upsertProgramSchedule(input.entityId, input.payload)
      return
    case "method_usage":
      await upsertMethodUsage(input.entityId, input.payload)
      return
    case "habit_usage":
      await upsertHabitUsage(input.entityId, input.payload)
      return
    case "personal_goal":
      await upsertPersonalGoal(input.entityId, input.payload)
      return
    case "personal_goal_usage":
      await upsertPersonalGoalUsage(input.entityId, input.payload)
      return
    case "overtuiging_usage":
      await upsertOvertuigingUsage(input.entityId, input.payload)
      return
    case "persoonlijke_overtuiging":
      await upsertPersoonlijkeOvertuiging(input.entityId, input.payload)
      return
    case "user":
      await upsertUser(input.entityId, input.payload)
      return
    default:
      throw new Error(`Unsupported outbox entity type: ${input.entityType}`)
  }
}
