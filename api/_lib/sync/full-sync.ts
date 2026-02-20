import { base, tables } from "../airtable.js"
import {
  HABIT_USAGE_FIELDS,
  METHOD_USAGE_FIELDS,
  OVERTUIGING_USAGE_FIELDS,
  parseEuropeanDate,
  PERSONAL_GOAL_FIELDS,
  PERSONAL_GOAL_USAGE_FIELDS,
  PROGRAM_FIELDS,
  PROGRAMMAPLANNING_FIELDS,
  USER_FIELDS
} from "../field-mappings.js"
import { dbQuery } from "../db/client.js"
import { upsertUserFromAirtable } from "../repos/user-repo.js"

interface FullSyncCounts {
  users: number
  referenceMethods: number
  referenceGoals: number
  referenceDays: number
  translations: number
  personalGoals: number
  programs: number
  schedules: number
  methodUsage: number
  habitUsage: number
  personalGoalUsage: number
  overtuigingUsage: number
  referenceOvertuigingen: number
  referenceMindsetCategories: number
}

async function syncReferenceTable(
  tableId: string,
  targetTable: "reference_methods_pg" | "reference_goals_pg" | "reference_days_pg" | "reference_overtuigingen_pg" | "reference_mindset_categories_pg"
): Promise<number> {
  const records = await base(tableId).select({ returnFieldsByFieldId: true }).all()
  let count = 0
  for (const record of records) {
    await dbQuery(
      `INSERT INTO ${targetTable} (id, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id)
       DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [record.id, JSON.stringify(record.fields || {})]
    )
    count += 1
  }
  return count
}

export async function syncReferenceDataFromAirtable(): Promise<{
  methods: number
  goals: number
  days: number
  overtuigingen: number
  mindsetCategories: number
}> {
  const methods = await syncReferenceTable(tables.methods, "reference_methods_pg")
  const goals = await syncReferenceTable(tables.goals, "reference_goals_pg")
  const days = await syncReferenceTable(tables.daysOfWeek, "reference_days_pg")
  const overtuigingen = await syncReferenceTable(tables.overtuigingen, "reference_overtuigingen_pg")
  const mindsetCategories = await syncReferenceTable(tables.mindsetCategories, "reference_mindset_categories_pg")
  return { methods, goals, days, overtuigingen, mindsetCategories }
}

export async function syncTranslationsFromAirtable(): Promise<number> {
  const exists = await dbQuery<{ table_name: string | null }>(
    `SELECT to_regclass('public.translations_pg') AS table_name`
  )
  if (!exists.rows[0]?.table_name) {
    return 0
  }

  const records = await base(tables.translations).select({}).all()
  let count = 0

  for (const record of records) {
    const fields = (record.fields || {}) as Record<string, unknown>
    const key = fields.Key ? String(fields.Key).trim() : ""
    if (!key) continue

    await dbQuery(
      `INSERT INTO translations_pg (key, nl, fr, en, context, airtable_record_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (key)
       DO UPDATE SET
         nl = EXCLUDED.nl,
         fr = EXCLUDED.fr,
         en = EXCLUDED.en,
         context = EXCLUDED.context,
         airtable_record_id = EXCLUDED.airtable_record_id,
         updated_at = NOW()`,
      [
        key,
        fields.nl ? String(fields.nl) : "",
        fields.fr ? String(fields.fr) : null,
        fields.en ? String(fields.en) : null,
        fields.Context ? String(fields.Context) : null,
        record.id
      ]
    )

    count += 1
  }

  return count
}

export async function syncUsersFromAirtable(): Promise<number> {
  const records = await base(tables.users).select({ returnFieldsByFieldId: true }).all()
  let count = 0
  for (const record of records) {
    await upsertUserFromAirtable({
      id: record.id,
      name: String(record.fields[USER_FIELDS.name] || ""),
      email: String(record.fields[USER_FIELDS.email] || ""),
      role: record.fields[USER_FIELDS.role] ? String(record.fields[USER_FIELDS.role]) : null,
      languageCode: record.fields[USER_FIELDS.languageCode] ? String(record.fields[USER_FIELDS.languageCode]) : null,
      passwordHash: record.fields[USER_FIELDS.passwordHash] ? String(record.fields[USER_FIELDS.passwordHash]) : null,
      lastLogin: record.fields[USER_FIELDS.lastLogin] ? String(record.fields[USER_FIELDS.lastLogin]) : null,
      bonusPoints: record.fields[USER_FIELDS.bonusPoints] ? Number(record.fields[USER_FIELDS.bonusPoints]) : null,
      badges: record.fields[USER_FIELDS.badges] ? String(record.fields[USER_FIELDS.badges]) : null,
      level: record.fields[USER_FIELDS.level] ? Number(record.fields[USER_FIELDS.level]) : null
    })
    count += 1
  }
  return count
}

export async function syncPersonalGoalsFromAirtable(): Promise<number> {
  const records = await base(tables.personalGoals).select({ returnFieldsByFieldId: true }).all()
  let count = 0
  for (const record of records) {
    const userId = (record.fields[PERSONAL_GOAL_FIELDS.user] as string[] | undefined)?.[0]
    if (!userId) continue

    // Parse schedule days from Airtable (comma-separated string or array)
    let scheduleDays: string[] | null = null
    const rawSchedule = record.fields[PERSONAL_GOAL_FIELDS.scheduleDays]
    if (rawSchedule) {
      if (Array.isArray(rawSchedule)) {
        scheduleDays = rawSchedule as string[]
      } else if (typeof rawSchedule === 'string') {
        scheduleDays = (rawSchedule as string).split(',').map((s: string) => s.trim()).filter(Boolean)
      }
    }

    const status = String(record.fields[PERSONAL_GOAL_FIELDS.status] || "Actief")

    await dbQuery(
      `INSERT INTO personal_goals_pg (id, user_id, name, description, active, schedule_days, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())
       ON CONFLICT (id)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         active = EXCLUDED.active,
         schedule_days = EXCLUDED.schedule_days,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      [
        record.id,
        userId,
        String(record.fields[PERSONAL_GOAL_FIELDS.name] || "Persoonlijk doel"),
        record.fields[PERSONAL_GOAL_FIELDS.description] ? String(record.fields[PERSONAL_GOAL_FIELDS.description]) : null,
        status !== "Gearchiveerd" && status !== "Verwijderd",
        scheduleDays ? JSON.stringify(scheduleDays) : null,
        status
      ]
    )
    count += 1
  }
  return count
}

export async function syncProgramsFromAirtable(): Promise<number> {
  const records = await base(tables.programs).select({ returnFieldsByFieldId: true }).all()
  let count = 0
  for (const record of records) {
    const userId = (record.fields[PROGRAM_FIELDS.user] as string[] | undefined)?.[0]
    if (!userId) continue

    const result = await dbQuery<{ id: string }>(
      `INSERT INTO programs_pg (
        user_id,
        airtable_record_id,
        name,
        start_date,
        duration,
        end_date,
        status,
        creation_type,
        notes,
        goals,
        methods,
        days_of_week,
        overtuigingen,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, NOW()
      )
      ON CONFLICT (airtable_record_id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        name = EXCLUDED.name,
        start_date = EXCLUDED.start_date,
        duration = EXCLUDED.duration,
        end_date = EXCLUDED.end_date,
        status = EXCLUDED.status,
        creation_type = EXCLUDED.creation_type,
        notes = EXCLUDED.notes,
        goals = EXCLUDED.goals,
        methods = EXCLUDED.methods,
        days_of_week = EXCLUDED.days_of_week,
        overtuigingen = EXCLUDED.overtuigingen,
        updated_at = NOW()
      RETURNING id`,
      [
        userId,
        record.id,
        String(record.fields[PROGRAM_FIELDS.programId] || ""),
        record.fields[PROGRAM_FIELDS.startDate]
          ? parseEuropeanDate(String(record.fields[PROGRAM_FIELDS.startDate]))
          : null,
        String(record.fields[PROGRAM_FIELDS.duration] || "4 weken"),
        record.fields[PROGRAM_FIELDS.endDate]
          ? parseEuropeanDate(String(record.fields[PROGRAM_FIELDS.endDate]))
          : null,
        record.fields[PROGRAM_FIELDS.status] ? String(record.fields[PROGRAM_FIELDS.status]) : null,
        record.fields[PROGRAM_FIELDS.creationType] ? String(record.fields[PROGRAM_FIELDS.creationType]) : null,
        record.fields[PROGRAM_FIELDS.notes] ? String(record.fields[PROGRAM_FIELDS.notes]) : null,
        JSON.stringify((record.fields[PROGRAM_FIELDS.goals] as string[]) || []),
        JSON.stringify((record.fields[PROGRAM_FIELDS.methods] as string[]) || []),
        JSON.stringify((record.fields[PROGRAM_FIELDS.daysOfWeek] as string[]) || []),
        JSON.stringify((record.fields[PROGRAM_FIELDS.overtuigingen] as string[]) || [])
      ]
    )

    if (result.rows[0]?.id) {
      await dbQuery(
        `INSERT INTO airtable_id_map (entity_type, postgres_id, airtable_record_id, last_synced_at)
         VALUES ('program', $1, $2, NOW())
         ON CONFLICT (entity_type, postgres_id)
         DO UPDATE SET airtable_record_id = EXCLUDED.airtable_record_id, last_synced_at = NOW()`,
        [result.rows[0].id, record.id]
      )
    }

    count += 1
  }
  return count
}

export async function syncProgramScheduleFromAirtable(): Promise<number> {
  const records = await base(tables.programmaplanning).select({ returnFieldsByFieldId: true }).all()
  let count = 0

  for (const record of records) {
    const airtableProgramId = (record.fields[PROGRAMMAPLANNING_FIELDS.program] as string[] | undefined)?.[0]
    if (!airtableProgramId) continue

    const mapped = await dbQuery<{ postgres_id: string }>(
      `SELECT postgres_id
       FROM airtable_id_map
       WHERE entity_type = 'program' AND airtable_record_id = $1
       LIMIT 1`,
      [airtableProgramId]
    )
    const postgresProgramId = mapped.rows[0]?.postgres_id
    if (!postgresProgramId) continue

    const result = await dbQuery<{ id: string }>(
      `INSERT INTO program_schedule_pg (
        program_id,
        airtable_record_id,
        planning_id,
        session_date,
        day_of_week_id,
        session_description,
        method_ids,
        goal_ids,
        method_usage_ids,
        notes,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, NOW()
      )
      ON CONFLICT (airtable_record_id)
      DO UPDATE SET
        program_id = EXCLUDED.program_id,
        planning_id = EXCLUDED.planning_id,
        session_date = EXCLUDED.session_date,
        day_of_week_id = EXCLUDED.day_of_week_id,
        session_description = EXCLUDED.session_description,
        method_ids = EXCLUDED.method_ids,
        goal_ids = EXCLUDED.goal_ids,
        method_usage_ids = EXCLUDED.method_usage_ids,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING id`,
      [
        postgresProgramId,
        record.id,
        record.fields[PROGRAMMAPLANNING_FIELDS.planningId]
          ? String(record.fields[PROGRAMMAPLANNING_FIELDS.planningId])
          : null,
        record.fields[PROGRAMMAPLANNING_FIELDS.date]
          ? parseEuropeanDate(String(record.fields[PROGRAMMAPLANNING_FIELDS.date]))
          : null,
        (record.fields[PROGRAMMAPLANNING_FIELDS.dayOfWeek] as string[] | undefined)?.[0] || null,
        record.fields[PROGRAMMAPLANNING_FIELDS.sessionDescription]
          ? String(record.fields[PROGRAMMAPLANNING_FIELDS.sessionDescription])
          : null,
        JSON.stringify((record.fields[PROGRAMMAPLANNING_FIELDS.methods] as string[]) || []),
        JSON.stringify((record.fields[PROGRAMMAPLANNING_FIELDS.goals] as string[]) || []),
        JSON.stringify((record.fields[PROGRAMMAPLANNING_FIELDS.methodUsage] as string[]) || []),
        record.fields[PROGRAMMAPLANNING_FIELDS.notes]
          ? String(record.fields[PROGRAMMAPLANNING_FIELDS.notes])
          : null
      ]
    )

    await dbQuery(
      `INSERT INTO airtable_id_map (entity_type, postgres_id, airtable_record_id, last_synced_at)
       VALUES ('program_schedule', $1, $2, NOW())
       ON CONFLICT (entity_type, postgres_id)
       DO UPDATE SET airtable_record_id = EXCLUDED.airtable_record_id, last_synced_at = NOW()`,
      [result.rows[0].id, record.id]
    )

    count += 1
  }

  return count
}

export async function syncMethodUsageFromAirtable(): Promise<number> {
  const records = await base(tables.methodUsage).select({ returnFieldsByFieldId: true }).all()
  let count = 0
  for (const record of records) {
    const userId = (record.fields[METHOD_USAGE_FIELDS.user] as string[] | undefined)?.[0]
    const methodId = (record.fields[METHOD_USAGE_FIELDS.method] as string[] | undefined)?.[0]
    if (!userId || !methodId) continue

    const airtableProgramId = (record.fields[METHOD_USAGE_FIELDS.program] as string[] | undefined)?.[0]
    const airtableScheduleId = (record.fields[METHOD_USAGE_FIELDS.programmaplanning] as string[] | undefined)?.[0]

    let programId: string | null = null
    let programScheduleId: string | null = null

    if (airtableProgramId) {
      const mapped = await dbQuery<{ postgres_id: string }>(
        `SELECT postgres_id
         FROM airtable_id_map
         WHERE entity_type = 'program' AND airtable_record_id = $1
         LIMIT 1`,
        [airtableProgramId]
      )
      programId = mapped.rows[0]?.postgres_id || null
    }

    if (airtableScheduleId) {
      const mapped = await dbQuery<{ postgres_id: string }>(
        `SELECT postgres_id
         FROM airtable_id_map
         WHERE entity_type = 'program_schedule' AND airtable_record_id = $1
         LIMIT 1`,
        [airtableScheduleId]
      )
      programScheduleId = mapped.rows[0]?.postgres_id || null
    }

    if (!programId && programScheduleId) {
      const mapped = await dbQuery<{ program_id: string }>(
        `SELECT program_id FROM program_schedule_pg WHERE id = $1 LIMIT 1`,
        [programScheduleId]
      )
      programId = mapped.rows[0]?.program_id || null
    }

    const result = await dbQuery<{ id: string }>(
      `INSERT INTO method_usage_pg (
        user_id,
        method_id,
        program_id,
        program_schedule_id,
        remark,
        used_at,
        airtable_record_id,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (airtable_record_id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        method_id = EXCLUDED.method_id,
        program_id = EXCLUDED.program_id,
        program_schedule_id = EXCLUDED.program_schedule_id,
        remark = EXCLUDED.remark,
        used_at = EXCLUDED.used_at,
        updated_at = NOW()
      RETURNING id`,
      [
        userId,
        methodId,
        programId,
        programScheduleId,
        record.fields[METHOD_USAGE_FIELDS.remark] ? String(record.fields[METHOD_USAGE_FIELDS.remark]) : null,
        record.fields[METHOD_USAGE_FIELDS.usedAt] ? String(record.fields[METHOD_USAGE_FIELDS.usedAt]) : new Date().toISOString().split("T")[0],
        record.id
      ]
    )

    await dbQuery(
      `INSERT INTO airtable_id_map (entity_type, postgres_id, airtable_record_id, last_synced_at)
       VALUES ('method_usage', $1, $2, NOW())
       ON CONFLICT (entity_type, postgres_id)
       DO UPDATE SET airtable_record_id = EXCLUDED.airtable_record_id, last_synced_at = NOW()`,
      [result.rows[0].id, record.id]
    )

    count += 1
  }

  await dbQuery(
    `UPDATE program_schedule_pg
     SET method_usage_ids = COALESCE(agg.ids, '[]'::jsonb)
     FROM (
       SELECT program_schedule_id, jsonb_agg(id::text ORDER BY used_at ASC, created_at ASC) AS ids
       FROM method_usage_pg
       WHERE program_schedule_id IS NOT NULL
       GROUP BY program_schedule_id
     ) agg
     WHERE program_schedule_pg.id = agg.program_schedule_id`
  )

  return count
}

export async function syncHabitUsageFromAirtable(): Promise<number> {
  const records = await base(tables.habitUsage).select({ returnFieldsByFieldId: true }).all()
  let count = 0
  for (const record of records) {
    const userId = (record.fields[HABIT_USAGE_FIELDS.user] as string[] | undefined)?.[0]
    const methodId = (record.fields[HABIT_USAGE_FIELDS.method] as string[] | undefined)?.[0]
    const date = record.fields[HABIT_USAGE_FIELDS.date] ? String(record.fields[HABIT_USAGE_FIELDS.date]) : null
    if (!userId || !methodId || !date) continue

    const result = await dbQuery<{ id: string }>(
      `INSERT INTO habit_usage_pg (user_id, method_id, usage_date, airtable_record_id, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, method_id, usage_date)
       DO UPDATE SET airtable_record_id = EXCLUDED.airtable_record_id, updated_at = NOW()
       RETURNING id`,
      [userId, methodId, date, record.id]
    )

    await dbQuery(
      `INSERT INTO airtable_id_map (entity_type, postgres_id, airtable_record_id, last_synced_at)
       VALUES ('habit_usage', $1, $2, NOW())
       ON CONFLICT (entity_type, postgres_id)
       DO UPDATE SET airtable_record_id = EXCLUDED.airtable_record_id, last_synced_at = NOW()`,
      [result.rows[0].id, record.id]
    )

    count += 1
  }
  return count
}

export async function syncPersonalGoalUsageFromAirtable(): Promise<number> {
  const records = await base(tables.personalGoalUsage).select({ returnFieldsByFieldId: true }).all()
  let count = 0
  for (const record of records) {
    const userId = (record.fields[PERSONAL_GOAL_USAGE_FIELDS.user] as string[] | undefined)?.[0]
    const goalId = (record.fields[PERSONAL_GOAL_USAGE_FIELDS.personalGoal] as string[] | undefined)?.[0]
    const date = record.fields[PERSONAL_GOAL_USAGE_FIELDS.date] ? String(record.fields[PERSONAL_GOAL_USAGE_FIELDS.date]) : null
    if (!userId || !goalId || !date) continue

    const result = await dbQuery<{ id: string }>(
      `INSERT INTO personal_goal_usage_pg (user_id, personal_goal_id, usage_date, airtable_record_id, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (airtable_record_id)
       DO UPDATE SET user_id = EXCLUDED.user_id, personal_goal_id = EXCLUDED.personal_goal_id, usage_date = EXCLUDED.usage_date, updated_at = NOW()
       RETURNING id`,
      [userId, goalId, date, record.id]
    )

    await dbQuery(
      `INSERT INTO airtable_id_map (entity_type, postgres_id, airtable_record_id, last_synced_at)
       VALUES ('personal_goal_usage', $1, $2, NOW())
       ON CONFLICT (entity_type, postgres_id)
       DO UPDATE SET airtable_record_id = EXCLUDED.airtable_record_id, last_synced_at = NOW()`,
      [result.rows[0].id, record.id]
    )

    count += 1
  }
  return count
}

export async function syncOvertuigingUsageFromAirtable(): Promise<number> {
  const records = await base(tables.overtuigingenGebruik).select({ returnFieldsByFieldId: true }).all()
  let count = 0
  for (const record of records) {
    const userId = (record.fields[OVERTUIGING_USAGE_FIELDS.user] as string[] | undefined)?.[0]
    const overtuigingId = (record.fields[OVERTUIGING_USAGE_FIELDS.overtuiging] as string[] | undefined)?.[0]
    if (!userId || !overtuigingId) continue

    const programId = (record.fields[OVERTUIGING_USAGE_FIELDS.program] as string[] | undefined)?.[0] || null
    const date = record.fields[OVERTUIGING_USAGE_FIELDS.date] ? String(record.fields[OVERTUIGING_USAGE_FIELDS.date]) : new Date().toISOString().split("T")[0]

    const result = await dbQuery<{ id: string }>(
      `INSERT INTO overtuiging_usage_pg (user_id, overtuiging_id, program_id, usage_date, airtable_record_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, overtuiging_id)
       DO UPDATE SET program_id = EXCLUDED.program_id, usage_date = EXCLUDED.usage_date, airtable_record_id = EXCLUDED.airtable_record_id, updated_at = NOW()
       RETURNING id`,
      [userId, overtuigingId, programId, date, record.id]
    )

    await dbQuery(
      `INSERT INTO airtable_id_map (entity_type, postgres_id, airtable_record_id, last_synced_at)
       VALUES ('overtuiging_usage', $1, $2, NOW())
       ON CONFLICT (entity_type, postgres_id)
       DO UPDATE SET airtable_record_id = EXCLUDED.airtable_record_id, last_synced_at = NOW()`,
      [result.rows[0].id, record.id]
    )

    count += 1
  }
  return count
}

export async function runFullAirtableToPostgresSync(): Promise<FullSyncCounts> {
  const users = await syncUsersFromAirtable()
  const refs = await syncReferenceDataFromAirtable()
  const translations = await syncTranslationsFromAirtable()
  const personalGoals = await syncPersonalGoalsFromAirtable()
  const programs = await syncProgramsFromAirtable()
  const schedules = await syncProgramScheduleFromAirtable()
  const methodUsage = await syncMethodUsageFromAirtable()
  const habitUsage = await syncHabitUsageFromAirtable()
  const personalGoalUsage = await syncPersonalGoalUsageFromAirtable()
  const overtuigingUsage = await syncOvertuigingUsageFromAirtable()

  return {
    users,
    referenceMethods: refs.methods,
    referenceGoals: refs.goals,
    referenceDays: refs.days,
    translations,
    referenceOvertuigingen: refs.overtuigingen,
    referenceMindsetCategories: refs.mindsetCategories,
    personalGoals,
    programs,
    schedules,
    methodUsage,
    habitUsage,
    personalGoalUsage,
    overtuigingUsage
  }
}
