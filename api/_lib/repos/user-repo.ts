import { dbQuery, withDbTransaction } from "../db/client.js"

export interface PgUser {
  id: string
  name: string
  email: string
  role: string | null
  languageCode: string | null
  passwordHash: string | null
  lastLogin: string | null
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  bonusPoints: number
  badges: string
  level: number
  totalPoints: number
  mentalFitnessScore: number
  personalGoalsScore: number
  goodHabitsScore: number
  createdAt: string
  updatedAt: string
  status: string
}

export interface UserRewardStats {
  user: PgUser
  habitCount: number
  methodCount: number
  personalGoalCount: number
  overtuigingCount: number
  habitDaysCount: number
  programsCompleted: number
}

function mapUserRow(row: Record<string, unknown>): PgUser {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    email: String(row.email || ""),
    role: row.role ? String(row.role) : null,
    languageCode: row.language_code ? String(row.language_code) : null,
    passwordHash: row.password_hash ? String(row.password_hash) : null,
    lastLogin: row.last_login ? String(row.last_login) : null,
    currentStreak: Number(row.current_streak || 0),
    longestStreak: Number(row.longest_streak || 0),
    lastActiveDate: row.last_active_date
      ? (row.last_active_date instanceof Date
          ? row.last_active_date.toISOString().slice(0, 10)
          : String(row.last_active_date).slice(0, 10))
      : null,
    bonusPoints: Number(row.bonus_points || 0),
    badges: String(row.badges || '[]'),
    level: Number(row.level || 1),
    totalPoints: Number(row.total_points || 0),
    mentalFitnessScore: Number(row.mental_fitness_score || 0),
    personalGoalsScore: Number(row.personal_goals_score || 0),
    goodHabitsScore: Number(row.good_habits_score || 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    status: String(row.status || 'active'),
  }
}

export function toApiUser(user: PgUser): Record<string, unknown> {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || undefined,
    languageCode: user.languageCode || undefined,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin || undefined
  }
}

export async function findUserById(id: string): Promise<PgUser | null> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT * FROM users_pg WHERE id = $1 LIMIT 1`,
    [id]
  )
  if (result.rows.length === 0) return null
  return mapUserRow(result.rows[0])
}

export async function findUserByEmail(email: string): Promise<PgUser | null> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT * FROM users_pg WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  )
  if (result.rows.length === 0) return null
  return mapUserRow(result.rows[0])
}

// All child tables that reference users_pg(id) via foreign key.
// When re-keying a user (Airtable ID changed), these must be updated first.
const USER_CHILD_TABLES = [
  "programs_pg",
  "method_usage_pg",
  "habit_usage_pg",
  "personal_goals_pg",
  "personal_goal_usage_pg",
  "overtuiging_usage_pg",
  "goede_gewoontes_usage_pg",
  "push_subscriptions_pg",
  "notification_preferences_pg",
  "notification_jobs_pg"
]

export async function upsertUserFromAirtable(record: {
  id: string
  name: string
  email: string
  role?: string | null
  languageCode?: string | null
  passwordHash?: string | null
  lastLogin?: string | null
  bonusPoints?: number | null
  badges?: string | null
  level?: number | null
  status?: string | null
}): Promise<PgUser> {
  const params = [
    record.id,
    record.name,
    record.email,
    record.role || null,
    record.languageCode || null,
    record.passwordHash || null,
    record.lastLogin || null,
    record.bonusPoints ?? null,
    record.badges || null,
    record.level ?? null,
    record.status || "active"
  ]

  // Fast path: try the normal upsert on id (handles the common case).
  try {
    const result = await dbQuery<Record<string, unknown>>(
      `INSERT INTO users_pg (
        id, name, email, role, language_code, password_hash, last_login,
        bonus_points, badges, level, status, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        language_code = EXCLUDED.language_code,
        password_hash = COALESCE(EXCLUDED.password_hash, users_pg.password_hash),
        last_login = COALESCE(EXCLUDED.last_login, users_pg.last_login),
        bonus_points = COALESCE(EXCLUDED.bonus_points, users_pg.bonus_points),
        badges = COALESCE(EXCLUDED.badges, users_pg.badges),
        level = COALESCE(EXCLUDED.level, users_pg.level),
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *`,
      params
    )
    return mapUserRow(result.rows[0])
  } catch (err: unknown) {
    // Check if this is a duplicate email error (user re-created in Airtable
    // with same email but new record ID). If not, re-throw.
    const pgError = err as { code?: string; constraint?: string }
    if (pgError.code !== "23505" || !pgError.constraint?.includes("email")) {
      throw err
    }
  }

  // Slow path: email exists under a different Airtable record ID.
  // Re-key the user row within a transaction so FK references stay intact.
  return withDbTransaction(async (client) => {
    // Find the existing row by email to get the old id
    const existing = await client.query<Record<string, unknown>>(
      `SELECT id FROM users_pg WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [record.email]
    )
    const oldId = String(existing.rows[0].id)
    const newId = record.id

    if (oldId !== newId) {
      // Re-key: update all child tables, then update the parent row's id
      for (const table of USER_CHILD_TABLES) {
        await client.query(
          `UPDATE ${table} SET user_id = $1 WHERE user_id = $2`,
          [newId, oldId]
        )
      }
      await client.query(`UPDATE users_pg SET id = $1 WHERE id = $2`, [newId, oldId])
    }

    // Now update the row's fields
    const result = await client.query<Record<string, unknown>>(
      `UPDATE users_pg
       SET name = $2,
           email = $3,
           role = $4,
           language_code = $5,
           password_hash = COALESCE($6, password_hash),
           last_login = COALESCE($7::date, last_login),
           bonus_points = COALESCE($8, bonus_points),
           badges = COALESCE($9, badges),
           level = COALESCE($10, level),
           status = $11,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      params
    )
    return mapUserRow(result.rows[0])
  })
}

export async function updateUserPasswordHash(id: string, hash: string): Promise<void> {
  await dbQuery(
    `UPDATE users_pg SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [hash, id]
  )
}

export async function updateUserLastLogin(id: string, lastLogin: string): Promise<void> {
  await dbQuery(
    `UPDATE users_pg
     SET last_login = $2, updated_at = NOW()
     WHERE id = $1`,
    [id, lastLogin]
  )
}

export async function updateUserProfileFields(input: {
  id: string
  name?: string
  role?: string
  languageCode?: string
  lastLogin?: string
}): Promise<void> {
  await dbQuery(
    `UPDATE users_pg
     SET name = COALESCE($2, name),
         role = COALESCE($3, role),
         language_code = COALESCE($4, language_code),
         last_login = COALESCE($5::date, last_login),
         updated_at = NOW()
     WHERE id = $1`,
    [
      input.id,
      input.name ?? null,
      input.role ?? null,
      input.languageCode ?? null,
      input.lastLogin ?? null
    ]
  )
}

export async function updateUserStreakFields(input: {
  userId: string
  currentStreak: number
  longestStreak: number
  lastActiveDate: string
}): Promise<void> {
  await dbQuery(
    `UPDATE users_pg
     SET current_streak = $2,
         longest_streak = $3,
         last_active_date = $4,
         updated_at = NOW()
     WHERE id = $1`,
    [input.userId, input.currentStreak, input.longestStreak, input.lastActiveDate]
  )
}

export async function upsertUsersBatch(
  records: Array<{
    id: string
    name: string
    email: string
    role?: string | null
    languageCode?: string | null
    passwordHash?: string | null
    lastLogin?: string | null
    bonusPoints?: number | null
    badges?: string | null
    level?: number | null
    status?: string | null
  }>
): Promise<number> {
  if (records.length === 0) return 0

  let count = 0
  for (const record of records) {
    await upsertUserFromAirtable(record)
    count += 1
  }
  return count
}

export async function incrementUserBonusPoints(userId: string, increment: number): Promise<void> {
  await dbQuery(
    `UPDATE users_pg
     SET bonus_points = COALESCE(bonus_points, 0) + $2, updated_at = NOW()
     WHERE id = $1`,
    [userId, increment]
  )
}

export async function getUserRewardsData(userId: string): Promise<{
  user: PgUser
  habitCount: number
  methodCount: number
  personalGoalCount: number
  overtuigingCount: number
} | null> {
  const stats = await getUserRewardStats(userId)
  if (!stats) return null
  return {
    user: stats.user,
    habitCount: stats.habitCount,
    methodCount: stats.methodCount,
    personalGoalCount: stats.personalGoalCount,
    overtuigingCount: stats.overtuigingCount
  }
}

export async function getUserRewardStats(userId: string): Promise<UserRewardStats | null> {
  const user = await findUserById(userId)
  if (!user) return null

  const [habits, methods, goals, overtuigingen, habitDays, programsCompleted] = await Promise.all([
    dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM goede_gewoontes_usage_pg WHERE user_id = $1`, [userId]),
    dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM method_usage_pg WHERE user_id = $1`, [userId]),
    dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM personal_goal_usage_pg WHERE user_id = $1`, [userId]),
    dbQuery<{ count: string }>(`SELECT COUNT(*) as count FROM overtuiging_usage_pg WHERE user_id = $1`, [userId]),
    dbQuery<{ count: string }>(`SELECT COUNT(DISTINCT usage_date) as count FROM goede_gewoontes_usage_pg WHERE user_id = $1`, [userId]),
    dbQuery<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM programs_pg
       WHERE user_id = $1
         AND status IN ('Afgewerkt', 'finished', 'Finished')`,
      [userId]
    )
  ])

  return {
    user,
    habitCount: Number(habits.rows[0]?.count || 0),
    methodCount: Number(methods.rows[0]?.count || 0),
    personalGoalCount: Number(goals.rows[0]?.count || 0),
    overtuigingCount: Number(overtuigingen.rows[0]?.count || 0),
    habitDaysCount: Number(habitDays.rows[0]?.count || 0),
    programsCompleted: Number(programsCompleted.rows[0]?.count || 0)
  }
}

export async function updateUserRewardFields(input: {
  userId: string
  bonusPoints: number
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  badges: string[]
  level: number
  totalPoints?: number
  mentalFitnessScore?: number
  personalGoalsScore?: number
  goodHabitsScore?: number
}): Promise<void> {
  await dbQuery(
    `UPDATE users_pg
     SET bonus_points = $2,
         current_streak = $3,
         longest_streak = $4,
         last_active_date = $5::date,
         badges = $6,
         level = $7,
         total_points = COALESCE($8, total_points),
         mental_fitness_score = COALESCE($9, mental_fitness_score),
         personal_goals_score = COALESCE($10, personal_goals_score),
         good_habits_score = COALESCE($11, good_habits_score),
         updated_at = NOW()
     WHERE id = $1`,
    [
      input.userId,
      input.bonusPoints,
      input.currentStreak,
      input.longestStreak,
      input.lastActiveDate,
      JSON.stringify(input.badges),
      input.level,
      input.totalPoints ?? null,
      input.mentalFitnessScore ?? null,
      input.personalGoalsScore ?? null,
      input.goodHabitsScore ?? null
    ]
  )
}

export async function updateUserGoedeGewoontes(userId: string, goedeGewoonteIds: string[]): Promise<void> {
  await dbQuery(
    `UPDATE users_pg SET goede_gewoontes = $2::jsonb, updated_at = NOW() WHERE id = $1`,
    [userId, JSON.stringify(goedeGewoonteIds)]
  )
}

export async function getUserGoedeGewoontes(userId: string): Promise<string[]> {
  const result = await dbQuery<{ goede_gewoontes: string }>(
    `SELECT goede_gewoontes FROM users_pg WHERE id = $1 LIMIT 1`,
    [userId]
  )
  if (result.rows.length === 0) return []
  const raw = result.rows[0].goede_gewoontes
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
