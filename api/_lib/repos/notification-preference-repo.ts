import { dbQuery } from "../db/client.js"
import type { NotificationPreferences, ReminderMode } from "../notifications/types.js"

const DEFAULT_TIMEZONE = process.env.NOTIFICATION_DEFAULT_TIMEZONE || "Europe/Brussels"

interface PreferenceRow {
  user_id: string
  enabled: boolean | null
  reminder_mode: string | null
  lead_minutes: number | null
  preferred_time_local: string | null
  timezone: string | null
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  language_code: string | null
}

function normalizeTime(timeValue: string | null | undefined, fallback: string): string {
  if (!timeValue) return fallback
  const [hour = "00", minute = "00"] = String(timeValue).split(":")
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
}

function parseReminderMode(value: string | null | undefined): ReminderMode {
  if (value === "session" || value === "daily_summary" || value === "both") {
    return value
  }
  return "both"
}

function mapRowToPreferences(row: PreferenceRow): NotificationPreferences {
  return {
    userId: row.user_id,
    enabled: row.enabled ?? true,
    reminderMode: parseReminderMode(row.reminder_mode),
    leadMinutes: Number(row.lead_minutes ?? 60),
    preferredTimeLocal: normalizeTime(row.preferred_time_local, "19:00"),
    timezone: row.timezone || DEFAULT_TIMEZONE,
    quietHoursStart: normalizeTime(row.quiet_hours_start, "22:00"),
    quietHoursEnd: normalizeTime(row.quiet_hours_end, "07:00")
  }
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
  const result = await dbQuery<PreferenceRow>(
    `SELECT
        u.id AS user_id,
        u.language_code,
        np.enabled,
        np.reminder_mode,
        np.lead_minutes,
        np.preferred_time_local::text AS preferred_time_local,
        np.timezone,
        np.quiet_hours_start::text AS quiet_hours_start,
        np.quiet_hours_end::text AS quiet_hours_end
      FROM users_pg u
      LEFT JOIN notification_preferences_pg np ON np.user_id = u.id
      WHERE u.id = $1
      LIMIT 1`,
    [userId]
  )

  if (result.rows.length === 0) return null
  return mapRowToPreferences(result.rows[0])
}

export async function upsertNotificationPreferences(input: {
  userId: string
  enabled?: boolean
  reminderMode?: ReminderMode
  leadMinutes?: number
  preferredTimeLocal?: string
  timezone?: string
  quietHoursStart?: string
  quietHoursEnd?: string
}): Promise<NotificationPreferences | null> {
  const current = await getNotificationPreferences(input.userId)
  if (!current) return null

  const merged: NotificationPreferences = {
    userId: input.userId,
    enabled: input.enabled ?? current.enabled,
    reminderMode: input.reminderMode ?? current.reminderMode,
    leadMinutes: input.leadMinutes ?? current.leadMinutes,
    preferredTimeLocal: input.preferredTimeLocal ?? current.preferredTimeLocal,
    timezone: input.timezone ?? current.timezone,
    quietHoursStart: input.quietHoursStart ?? current.quietHoursStart,
    quietHoursEnd: input.quietHoursEnd ?? current.quietHoursEnd
  }

  await dbQuery(
    `INSERT INTO notification_preferences_pg (
      user_id,
      enabled,
      reminder_mode,
      lead_minutes,
      preferred_time_local,
      timezone,
      quiet_hours_start,
      quiet_hours_end,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5::time, $6, $7::time, $8::time, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      enabled = EXCLUDED.enabled,
      reminder_mode = EXCLUDED.reminder_mode,
      lead_minutes = EXCLUDED.lead_minutes,
      preferred_time_local = EXCLUDED.preferred_time_local,
      timezone = EXCLUDED.timezone,
      quiet_hours_start = EXCLUDED.quiet_hours_start,
      quiet_hours_end = EXCLUDED.quiet_hours_end,
      updated_at = NOW()`,
    [
      merged.userId,
      merged.enabled,
      merged.reminderMode,
      merged.leadMinutes,
      merged.preferredTimeLocal,
      merged.timezone || DEFAULT_TIMEZONE,
      merged.quietHoursStart,
      merged.quietHoursEnd
    ]
  )

  return getNotificationPreferences(input.userId)
}

export async function listUsersForNotificationPlanning(): Promise<string[]> {
  const result = await dbQuery<{ user_id: string }>(
    `SELECT DISTINCT user_id
       FROM programs_pg
      WHERE status IN ('Actief', 'Gepland')
      UNION
     SELECT DISTINCT user_id
       FROM notification_preferences_pg
      WHERE enabled = TRUE`
  )
  return result.rows.map((row) => row.user_id)
}

export async function getUserLanguageCode(userId: string): Promise<string | null> {
  const result = await dbQuery<{ language_code: string | null }>(
    `SELECT language_code
       FROM users_pg
      WHERE id = $1
      LIMIT 1`,
    [userId]
  )
  if (result.rows.length === 0) return null
  return result.rows[0].language_code || null
}

export function getDefaultTimezone(): string {
  return DEFAULT_TIMEZONE
}
