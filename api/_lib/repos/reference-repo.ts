import { dbQuery } from "../db/client.js"
import {
  METHOD_FIELDS,
  GOAL_FIELDS,
  COMPANY_FIELDS,
  transformMethod,
  transformGoal,
  transformDay,
  transformOvertuiging,
  transformMindsetCategory,
  transformProgramPrompt,
  transformExperienceLevel,
  transformGoedeGewoonte
} from "../field-mappings.js"

// ---------- Methods ----------

export async function listAllMethods(): Promise<Record<string, unknown>[]> {
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_methods_pg ORDER BY (payload->>'_syncOrder')::int`
  )
  return result.rows.map(row => transformMethod({ id: row.id, fields: row.payload }))
}

export async function getMethodById(id: string): Promise<Record<string, unknown> | null> {
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_methods_pg WHERE id = $1 LIMIT 1`,
    [id]
  )
  if (result.rows.length === 0) return null

  const row = result.rows[0]
  return transformMethod({ id: row.id, fields: row.payload })
}

export async function getMethodPointsValue(methodId: string): Promise<number> {
  const method = await getMethodById(methodId)
  if (!method) return 5 // safe default
  return Number((method as Record<string, unknown>).pointsValue) || 5
}

export async function getMethodsByGoalId(goalId: string): Promise<Record<string, unknown>[]> {
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_methods_pg`
  )

  return result.rows
    .filter((row) => {
      const linkedGoals = row.payload[METHOD_FIELDS.linkedGoals] as string[] | undefined
      return linkedGoals?.includes(goalId)
    })
    .map((row) => ({
      id: row.id,
      name: String(row.payload[METHOD_FIELDS.name] || ""),
      description: row.payload[METHOD_FIELDS.description] as string | undefined
    }))
}

// ---------- Goals ----------

export async function getGoalByName(name: string): Promise<{ id: string; name: string } | null> {
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_goals_pg`
  )

  const match = result.rows.find((row) => {
    const goalName = String(row.payload[GOAL_FIELDS.name] || "")
    return goalName === name
  })

  if (!match) return null
  return { id: match.id, name: String(match.payload[GOAL_FIELDS.name] || "") }
}

export async function listAllGoals(): Promise<Record<string, unknown>[]> {
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_goals_pg ORDER BY (payload->>'_syncOrder')::int`
  )
  return result.rows.map(row => transformGoal({ id: row.id, fields: row.payload }))
}

// ---------- Days ----------

export async function listAllDays(): Promise<Record<string, unknown>[]> {
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_days_pg`
  )
  return result.rows.map(row => transformDay({ id: row.id, fields: row.payload }))
}

// ---------- Lookup by IDs (for program detail) ----------

export async function lookupGoalsByIds(ids: string[]): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return []
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_goals_pg WHERE id = ANY($1::text[]) ORDER BY (payload->>'_syncOrder')::int`,
    [ids]
  )
  return result.rows.map(row => transformGoal({ id: row.id, fields: row.payload }))
}

export async function lookupMethodsByIds(ids: string[]): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return []
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_methods_pg WHERE id = ANY($1::text[]) ORDER BY (payload->>'_syncOrder')::int`,
    [ids]
  )
  return result.rows.map(row => transformMethod({ id: row.id, fields: row.payload }))
}

export async function lookupDayNamesByIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_days_pg WHERE id = ANY($1::text[])`,
    [ids]
  )
  return result.rows.map(row => transformDay({ id: row.id, fields: row.payload }).name)
}

export async function lookupDaysByIds(ids: string[]): Promise<Array<{ id: string; name: string }>> {
  if (ids.length === 0) return []
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_days_pg WHERE id = ANY($1::text[])`,
    [ids]
  )
  return result.rows.map(row => transformDay({ id: row.id, fields: row.payload }))
}

export async function lookupOvertuigingenByIds(ids: string[]): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return []
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_overtuigingen_pg WHERE id = ANY($1::text[])`,
    [ids]
  )
  return result.rows.map(row => transformOvertuiging({ id: row.id, fields: row.payload }))
}

// ---------- Mindset Categories ----------

export async function listAllMindsetCategories(): Promise<Record<string, unknown>[]> {
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_mindset_categories_pg ORDER BY (payload->>'_syncOrder')::int`
  )
  return result.rows.map(row => transformMindsetCategory({ id: row.id, fields: row.payload }))
}

// ---------- Companies ----------

export async function lookupCompanyNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_companies_pg WHERE id = ANY($1::text[])`,
    [ids]
  )
  const map: Record<string, string> = {}
  for (const row of result.rows) {
    const name = row.payload[COMPANY_FIELDS.name]
    if (name) map[row.id] = String(name)
  }
  return map
}

// ---------- Overtuigingen ----------

export async function listAllOvertuigingen(): Promise<Record<string, unknown>[]> {
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_overtuigingen_pg`
  )
  return result.rows
    .map(row => transformOvertuiging({ id: row.id, fields: row.payload }))
    .sort((a, b) => ((a.order as number) || 0) - ((b.order as number) || 0))
}

export async function getOvertuigingenByGoalIds(goalIds: string[]): Promise<Record<string, unknown>[]> {
  if (goalIds.length === 0) return []

  // Step 1: Get mindset categories that match the goalIds
  const catResult = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_mindset_categories_pg`
  )

  const matchingCategoryIds = new Set<string>()
  for (const row of catResult.rows) {
    const cat = transformMindsetCategory({ id: row.id, fields: row.payload })
    const catGoalIds = cat.goalIds as string[]
    if (catGoalIds.some((gid: string) => goalIds.includes(gid))) {
      matchingCategoryIds.add(row.id)
    }
  }

  // Step 2: Get overtuigingen and match by either:
  // - direct link to goals on overtuiging record
  // - linked category that matches selected goals
  const overtResult = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_overtuigingen_pg`
  )

  return overtResult.rows
    .map((row) => transformOvertuiging({ id: row.id, fields: row.payload }))
    .filter((o) => {
      const goalIdsDirect = o.goalIds as string[] | undefined
      const categoryIds = o.categoryIds as string[]
      const matchesDirectGoal = (goalIdsDirect || []).some((gid: string) => goalIds.includes(gid))
      const matchesCategoryGoal = categoryIds.some((cid: string) => matchingCategoryIds.has(cid))
      return matchesDirectGoal || matchesCategoryGoal
    })
    .sort((a, b) => ((a.order as number) || 0) - ((b.order as number) || 0))
}

// ---------- Program Prompts ----------

export async function listAllProgramPrompts(): Promise<Record<string, unknown>[]> {
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_program_prompts_pg`
  )
  return result.rows.map(row => transformProgramPrompt({ id: row.id, fields: row.payload }))
}

// ---------- Experience Levels ----------

export async function listAllExperienceLevels(): Promise<Record<string, unknown>[]> {
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_experience_levels_pg`
  )
  return result.rows.map(row => transformExperienceLevel({ id: row.id, fields: row.payload }))
}

// ---------- Goede Gewoontes ----------

export async function listAllGoedeGewoontes(): Promise<Record<string, unknown>[]> {
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_goede_gewoontes_pg ORDER BY (payload->>'_syncOrder')::int`
  )
  return result.rows.map(row => transformGoedeGewoonte({ id: row.id, fields: row.payload }))
}

export async function lookupGoedeGewoontesByIds(ids: string[]): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return []
  const result = await dbQuery<{ id: string; payload: Record<string, unknown> }>(
    `SELECT id, payload FROM reference_goede_gewoontes_pg WHERE id = ANY($1::text[]) ORDER BY (payload->>'_syncOrder')::int`,
    [ids]
  )
  return result.rows.map(row => transformGoedeGewoonte({ id: row.id, fields: row.payload }))
}

// ---------- Personal Goals ----------

function parseScheduleDays(raw: unknown): string[] | undefined {
  if (raw == null) return undefined
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as string[] } catch { return undefined }
  }
  if (Array.isArray(raw)) return raw as string[]
  return undefined
}

function mapPersonalGoalRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    description: row.description ? String(row.description) : undefined,
    userId: String(row.user_id),
    status: String(row.status || "Actief"),
    scheduleDays: parseScheduleDays(row.schedule_days),
    createdAt: row.created_at ? String(row.created_at) : undefined
  }
}

export async function listPersonalGoalsByUser(
  userId: string,
  options?: { includeCompleted?: boolean }
): Promise<Record<string, unknown>[]> {
  const includeCompleted = options?.includeCompleted ?? false
  const statusClause = includeCompleted
    ? `(status = 'Actief' OR status = 'Voltooid')`
    : `status = 'Actief'`

  const result = await dbQuery<Record<string, unknown>>(
    `SELECT id, user_id, name, description, status, schedule_days, created_at
     FROM personal_goals_pg
     WHERE user_id = $1 AND ${statusClause}
     ORDER BY created_at ASC`,
    [userId]
  )

  return result.rows.map(mapPersonalGoalRow)
}

export async function createPersonalGoalInPostgres(input: {
  userId: string
  name: string
  description?: string
  scheduleDays?: string[]
}): Promise<Record<string, unknown>> {
  const result = await dbQuery<Record<string, unknown>>(
    `INSERT INTO personal_goals_pg (id, user_id, name, description, schedule_days, status, active, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, 'Actief', true, NOW())
     RETURNING *`,
    [
      input.userId,
      input.name,
      input.description || null,
      input.scheduleDays ? JSON.stringify(input.scheduleDays) : null
    ]
  )

  return mapPersonalGoalRow(result.rows[0])
}

export async function updatePersonalGoalInPostgres(
  id: string,
  userId: string,
  updates: {
    name?: string
    description?: string
    scheduleDays?: string[] | null
    status?: string
  }
): Promise<Record<string, unknown> | null> {
  const setClauses: string[] = []
  const params: unknown[] = [id, userId]
  let paramIndex = 3

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`)
    params.push(updates.name)
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`)
    params.push(updates.description)
  }
  if (updates.scheduleDays !== undefined) {
    setClauses.push(`schedule_days = $${paramIndex++}::jsonb`)
    params.push(updates.scheduleDays ? JSON.stringify(updates.scheduleDays) : null)
  }
  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`)
    params.push(updates.status)
  }

  if (setClauses.length === 0) return null

  setClauses.push("updated_at = NOW()")

  const result = await dbQuery<Record<string, unknown>>(
    `UPDATE personal_goals_pg
     SET ${setClauses.join(", ")}
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    params
  )

  if (result.rows.length === 0) return null
  return mapPersonalGoalRow(result.rows[0])
}

export async function deletePersonalGoalInPostgres(
  id: string,
  userId: string
): Promise<boolean> {
  const result = await dbQuery(
    `UPDATE personal_goals_pg
     SET status = 'Verwijderd', updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status != 'Verwijderd'`,
    [id, userId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function listScheduledPersonalGoalsForUser(
  userId: string
): Promise<{ id: string; name: string; scheduleDays: string[] }[]> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT id, name, schedule_days
     FROM personal_goals_pg
     WHERE user_id = $1 AND status = 'Actief' AND schedule_days IS NOT NULL
     ORDER BY created_at ASC`,
    [userId]
  )

  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name || ""),
    scheduleDays: parseScheduleDays(row.schedule_days) || []
  }))
}
