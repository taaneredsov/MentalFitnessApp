import { dbQuery, withDbTransaction } from "../db/client.js"
import type { PoolClient } from "pg"
import { isAirtableRecordId } from "../db/id-utils.js"

export interface PgProgram {
  id: string
  userId: string
  airtableRecordId: string | null
  name: string | null
  startDate: string
  duration: string
  endDate: string | null
  status: string | null
  creationType: string | null
  notes: string | null
  goals: string[]
  methods: string[]
  daysOfWeek: string[]
  overtuigingen: string[]
  createdAt: string
  updatedAt: string
}

export interface PgProgramSession {
  id: string
  programId: string
  airtableRecordId: string | null
  planningId: string | null
  date: string | null
  dayOfWeekId: string | null
  sessionDescription: string | null
  methodIds: string[]
  goalIds: string[]
  methodUsageIds: string[]
  notes: string | null
}

interface CreateProgramInput {
  userId: string
  startDate: string
  duration: string
  notes?: string
  goals?: string[]
  methods?: string[]
  daysOfWeek?: string[]
  overtuigingen?: string[]
  creationType?: string
}

interface UpdateProgramInput {
  goals?: string[]
  methods?: string[]
  daysOfWeek?: string[]
  notes?: string
  overtuigingen?: string[]
}

function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v))
}

function mapProgramRow(row: Record<string, unknown>): PgProgram {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    airtableRecordId: row.airtable_record_id ? String(row.airtable_record_id) : null,
    name: row.name ? String(row.name) : null,
    startDate: String(row.start_date),
    duration: String(row.duration),
    endDate: row.end_date ? String(row.end_date) : null,
    status: row.status ? String(row.status) : null,
    creationType: row.creation_type ? String(row.creation_type) : null,
    notes: row.notes ? String(row.notes) : null,
    goals: parseJsonStringArray(row.goals),
    methods: parseJsonStringArray(row.methods),
    daysOfWeek: parseJsonStringArray(row.days_of_week),
    overtuigingen: parseJsonStringArray(row.overtuigingen),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }
}

function mapSessionRow(row: Record<string, unknown>): PgProgramSession {
  return {
    id: String(row.id),
    programId: String(row.program_id),
    airtableRecordId: row.airtable_record_id ? String(row.airtable_record_id) : null,
    planningId: row.planning_id ? String(row.planning_id) : null,
    date: row.session_date ? String(row.session_date) : null,
    dayOfWeekId: row.day_of_week_id ? String(row.day_of_week_id) : null,
    sessionDescription: row.session_description ? String(row.session_description) : null,
    methodIds: parseJsonStringArray(row.method_ids),
    goalIds: parseJsonStringArray(row.goal_ids),
    methodUsageIds: parseJsonStringArray(row.method_usage_ids),
    notes: row.notes ? String(row.notes) : null
  }
}

function calculateEndDate(startDate: string, duration: string): string {
  const weeks = parseInt(duration.match(/(\d+)/)?.[1] || "4", 10)
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + (weeks * 7) - 1)
  return end.toISOString().split("T")[0]
}

function dateRangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return start1 <= end2 && end1 >= start2
}

function getInitialProgramStatus(startDate: string): "Actief" | "Gepland" {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  return startDate <= todayStr ? "Actief" : "Gepland"
}

export function toApiProgram(program: PgProgram): Record<string, unknown> {
  return {
    id: program.id,
    name: program.name || undefined,
    startDate: program.startDate,
    endDate: program.endDate,
    duration: program.duration,
    daysOfWeek: program.daysOfWeek,
    goals: program.goals,
    methods: program.methods,
    notes: program.notes || undefined,
    status: program.status,
    creationType: program.creationType || "Manueel",
    overtuigingen: program.overtuigingen
  }
}

export async function createProgram(input: CreateProgramInput): Promise<PgProgram> {
  return withDbTransaction(async (client) => {
    const endDate = calculateEndDate(input.startDate, input.duration)

    const existingResult = await client.query<Record<string, unknown>>(
      `SELECT start_date, end_date, status
       FROM programs_pg
       WHERE user_id = $1
         AND status IN ('Actief', 'Gepland')`,
      [input.userId]
    )

    for (const row of existingResult.rows) {
      const existingStart = String(row.start_date)
      const existingEnd = String(row.end_date)
      if (dateRangesOverlap(input.startDate, endDate, existingStart, existingEnd)) {
        throw new Error("PROGRAM_OVERLAP")
      }
    }

    const result = await client.query<Record<string, unknown>>(
      `INSERT INTO programs_pg (
        user_id,
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
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, NOW()
      )
      RETURNING *`,
      [
        input.userId,
        input.startDate,
        input.duration,
        endDate,
        getInitialProgramStatus(input.startDate),
        input.creationType || "Manueel",
        input.notes || null,
        JSON.stringify(input.goals || []),
        JSON.stringify(input.methods || []),
        JSON.stringify(input.daysOfWeek || []),
        JSON.stringify(input.overtuigingen || [])
      ]
    )

    return mapProgramRow(result.rows[0])
  })
}

export async function listProgramsByUser(userId: string): Promise<PgProgram[]> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT *
     FROM programs_pg
     WHERE user_id = $1
     ORDER BY start_date DESC, created_at DESC`,
    [userId]
  )
  return result.rows.map(mapProgramRow)
}

export async function getProgramById(programId: string, userId?: string): Promise<PgProgram | null> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT *
     FROM programs_pg
     WHERE id = $1
       AND ($2::text IS NULL OR user_id = $2::text)
     LIMIT 1`,
    [programId, userId || null]
  )
  if (result.rows.length === 0) return null
  return mapProgramRow(result.rows[0])
}

export async function getProgramByAnyId(programId: string, userId?: string): Promise<PgProgram | null> {
  if (!isAirtableRecordId(programId)) {
    const byId = await getProgramById(programId, userId)
    if (byId) return byId
    return null
  }

  const result = await dbQuery<Record<string, unknown>>(
    `SELECT *
     FROM programs_pg
     WHERE airtable_record_id = $1
       AND ($2::text IS NULL OR user_id = $2::text)
     LIMIT 1`,
    [programId, userId || null]
  )

  if (result.rows.length === 0) return null
  return mapProgramRow(result.rows[0])
}

export async function listProgramSessions(programId: string): Promise<PgProgramSession[]> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT *
     FROM program_schedule_pg
     WHERE program_id = $1
     ORDER BY session_date ASC NULLS LAST, created_at ASC`,
    [programId]
  )
  return result.rows.map(mapSessionRow)
}

export async function getProgramSessionByAnyId(sessionId: string, programId?: string): Promise<PgProgramSession | null> {
  const byUuid = await dbQuery<Record<string, unknown>>(
    `SELECT *
     FROM program_schedule_pg
     WHERE id::text = $1
       AND ($2::uuid IS NULL OR program_id = $2::uuid)
     LIMIT 1`,
    [sessionId, programId || null]
  )
  if (byUuid.rows.length > 0) {
    return mapSessionRow(byUuid.rows[0])
  }

  if (!isAirtableRecordId(sessionId)) {
    return null
  }

  const byAirtable = await dbQuery<Record<string, unknown>>(
    `SELECT *
     FROM program_schedule_pg
     WHERE airtable_record_id = $1
       AND ($2::uuid IS NULL OR program_id = $2::uuid)
     LIMIT 1`,
    [sessionId, programId || null]
  )

  if (byAirtable.rows.length === 0) return null
  return mapSessionRow(byAirtable.rows[0])
}

export async function updateProgramSessionById(input: {
  sessionId: string
  programId: string
  methods: string[]
  goals?: string[]
  notes?: string
  sessionDescription?: string
}): Promise<PgProgramSession | null> {
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  fields.push(`method_ids = $${idx++}::jsonb`)
  values.push(JSON.stringify(input.methods))

  if (input.goals !== undefined) {
    fields.push(`goal_ids = $${idx++}::jsonb`)
    values.push(JSON.stringify(input.goals))
  }
  if (input.notes !== undefined) {
    fields.push(`notes = $${idx++}`)
    values.push(input.notes)
  }
  if (input.sessionDescription !== undefined) {
    fields.push(`session_description = $${idx++}`)
    values.push(input.sessionDescription)
  }

  const isAirtable = isAirtableRecordId(input.sessionId)
  const sessionPredicate = isAirtable
    ? `airtable_record_id = $${idx++}`
    : `id::text = $${idx++}`
  values.push(input.sessionId)

  const query = `
    UPDATE program_schedule_pg
    SET ${fields.join(", ")}, updated_at = NOW()
    WHERE ${sessionPredicate} AND program_id = $${idx++}::uuid
    RETURNING *
  `
  values.push(input.programId)

  const result = await dbQuery<Record<string, unknown>>(query, values)
  if (result.rows.length === 0) return null
  return mapSessionRow(result.rows[0])
}

export async function getMethodUsageByProgram(programId: string): Promise<Array<Record<string, unknown>>> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT id, program_schedule_id, method_id, used_at
     FROM method_usage_pg
     WHERE program_id = $1`,
    [programId]
  )
  return result.rows
}

export async function getLatestMethodUsageByProgram(programId: string, limit: number): Promise<Array<Record<string, unknown>>> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT id, user_id, method_id, program_id, program_schedule_id, remark, used_at
     FROM method_usage_pg
     WHERE program_id = $1
     ORDER BY used_at DESC, created_at DESC
     LIMIT $2`,
    [programId, limit]
  )
  return result.rows
}

export async function updateProgramById(
  programId: string,
  userId: string,
  input: UpdateProgramInput,
  client?: PoolClient
): Promise<PgProgram | null> {
  const run = async (dbClient: PoolClient): Promise<PgProgram | null> => {
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (input.goals !== undefined) {
      fields.push(`goals = $${idx++}::jsonb`)
      values.push(JSON.stringify(input.goals))
    }
    if (input.methods !== undefined) {
      fields.push(`methods = $${idx++}::jsonb`)
      values.push(JSON.stringify(input.methods))
    }
    if (input.daysOfWeek !== undefined) {
      fields.push(`days_of_week = $${idx++}::jsonb`)
      values.push(JSON.stringify(input.daysOfWeek))
    }
    if (input.notes !== undefined) {
      fields.push(`notes = $${idx++}`)
      values.push(input.notes)
    }
    if (input.overtuigingen !== undefined) {
      fields.push(`overtuigingen = $${idx++}::jsonb`)
      values.push(JSON.stringify(input.overtuigingen))
    }

    if (fields.length === 0) {
      const existing = await dbClient.query<Record<string, unknown>>(
        `SELECT * FROM programs_pg WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [programId, userId]
      )
      return existing.rows.length ? mapProgramRow(existing.rows[0]) : null
    }

    const query = `
      UPDATE programs_pg
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${idx++} AND user_id = $${idx++}
      RETURNING *
    `
    values.push(programId, userId)

    const result = await dbClient.query<Record<string, unknown>>(query, values)
    if (result.rows.length === 0) return null
    return mapProgramRow(result.rows[0])
  }

  if (client) return run(client)
  return withDbTransaction(run)
}

export async function computeProgramProgress(programs: PgProgram[]): Promise<Map<string, {
  totalMethods: number
  completedMethods: number
  totalSessions: number
  completedSessions: number
}>> {
  if (programs.length === 0) return new Map()

  const ids = programs.map((p) => p.id)
  const sessionsResult = await dbQuery<Record<string, unknown>>(
    `SELECT *
     FROM program_schedule_pg
     WHERE program_id = ANY($1::uuid[])`,
    [ids]
  )
  const sessions = sessionsResult.rows.map(mapSessionRow)

  const usageResult = await dbQuery<Record<string, unknown>>(
    `SELECT id, program_id, program_schedule_id
     FROM method_usage_pg
     WHERE program_id = ANY($1::uuid[])`,
    [ids]
  )

  const usageByProgram = new Map<string, number>()
  const usageBySession = new Map<string, number>()

  for (const row of usageResult.rows) {
    const pid = String(row.program_id)
    usageByProgram.set(pid, (usageByProgram.get(pid) || 0) + 1)
    if (row.program_schedule_id) {
      const sid = String(row.program_schedule_id)
      usageBySession.set(sid, (usageBySession.get(sid) || 0) + 1)
    }
  }

  const sessionsByProgram = new Map<string, PgProgramSession[]>()
  for (const session of sessions) {
    const arr = sessionsByProgram.get(session.programId) || []
    arr.push(session)
    sessionsByProgram.set(session.programId, arr)
  }

  const progress = new Map<string, {
    totalMethods: number
    completedMethods: number
    totalSessions: number
    completedSessions: number
  }>()

  for (const program of programs) {
    const programSessions = sessionsByProgram.get(program.id) || []
    const totalMethods = programSessions.reduce((sum, s) => sum + s.methodIds.length, 0)
    const completedMethods = usageByProgram.get(program.id) || 0
    const totalSessions = programSessions.length
    const completedSessions = programSessions.filter((s) => {
      const needed = s.methodIds.length
      if (needed === 0) return false
      const completed = usageBySession.get(s.id) || 0
      return completed >= needed
    }).length

    progress.set(program.id, {
      totalMethods,
      completedMethods,
      totalSessions,
      completedSessions
    })
  }

  return progress
}
