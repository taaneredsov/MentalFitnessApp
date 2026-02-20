import { dbQuery } from "../db/client.js"
import {
  cancelNotificationJobsForUser,
  cancelNotificationJobsNotInSet,
  upsertNotificationJobs,
  type NotificationJobCandidate
} from "../repos/notification-job-repo.js"
import {
  getDefaultTimezone,
  getNotificationPreferences,
  getUserLanguageCode,
  listUsersForNotificationPlanning
} from "../repos/notification-preference-repo.js"
import { listScheduledPersonalGoalsForUser } from "../repos/reference-repo.js"
import { addMinutes, formatDateInTimeZone, formatTimeInTimeZone, isTimeInsideQuietHours, zonedDateTimeToUtc } from "./time.js"
import type { NotificationJobPayload } from "./types.js"

interface SessionRow {
  program_id: string
  program_schedule_id: string
  session_date: string
  planned_methods: number
  completed_methods: number
}

interface PlannerResult {
  userId: string
  generated: number
  reminderMode: string
}

function isSupportedLocaleLanguage(code: string | null): "nl" | "en" | "fr" {
  if (!code) return "nl"
  const normalized = code.toLowerCase()
  if (normalized.startsWith("en")) return "en"
  if (normalized.startsWith("fr")) return "fr"
  return "nl"
}

function resolveTimeZone(timezone: string | null | undefined): string {
  const candidate = timezone || getDefaultTimezone()
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return getDefaultTimezone()
  }
}

function buildSessionPayload(input: {
  language: "nl" | "en" | "fr"
  reminderDate: string
  programId: string
  programScheduleId: string
}): NotificationJobPayload {
  if (input.language === "en") {
    return {
      title: "Time for your activity",
      body: `Your mental fitness activity for ${input.reminderDate} is ready.`,
      targetUrl: "/",
      mode: "session",
      reminderDate: input.reminderDate,
      programId: input.programId,
      programScheduleId: input.programScheduleId
    }
  }

  if (input.language === "fr") {
    return {
      title: "Votre activite vous attend",
      body: `Votre activite de forme mentale du ${input.reminderDate} est prete.`,
      targetUrl: "/",
      mode: "session",
      reminderDate: input.reminderDate,
      programId: input.programId,
      programScheduleId: input.programScheduleId
    }
  }

  return {
    title: "Tijd voor je activiteit",
    body: `Je mentale fitness activiteit voor ${input.reminderDate} staat klaar.`,
    targetUrl: "/",
    mode: "session",
    reminderDate: input.reminderDate,
    programId: input.programId,
    programScheduleId: input.programScheduleId
  }
}

function buildDailyPayload(input: {
  language: "nl" | "en" | "fr"
  reminderDate: string
  sessionCount: number
}): NotificationJobPayload {
  if (input.language === "en") {
    return {
      title: "Daily activity reminder",
      body: `You have ${input.sessionCount} scheduled activit${input.sessionCount === 1 ? "y" : "ies"} today.`,
      targetUrl: "/",
      mode: "daily_summary",
      reminderDate: input.reminderDate,
      sessionCount: input.sessionCount
    }
  }

  if (input.language === "fr") {
    return {
      title: "Rappel quotidien",
      body: `Vous avez ${input.sessionCount} activite${input.sessionCount === 1 ? "" : "s"} prevue${input.sessionCount === 1 ? "" : "s"} aujourd'hui.`,
      targetUrl: "/",
      mode: "daily_summary",
      reminderDate: input.reminderDate,
      sessionCount: input.sessionCount
    }
  }

  return {
    title: "Dagelijkse herinnering",
    body: `Je hebt vandaag ${input.sessionCount} geplande activite${input.sessionCount === 1 ? "it" : "iten"}.`,
    targetUrl: "/",
    mode: "daily_summary",
    reminderDate: input.reminderDate,
    sessionCount: input.sessionCount
  }
}

async function listSchedulableSessionsForUser(userId: string): Promise<SessionRow[]> {
  const result = await dbQuery<SessionRow>(
    `SELECT
        p.id AS program_id,
        s.id AS program_schedule_id,
        s.session_date::text AS session_date,
        COALESCE(jsonb_array_length(s.method_ids), 0)::integer AS planned_methods,
        COALESCE(mu.completed_methods, 0)::integer AS completed_methods
      FROM program_schedule_pg s
      JOIN programs_pg p ON p.id = s.program_id
      LEFT JOIN (
        SELECT program_schedule_id, COUNT(*)::integer AS completed_methods
          FROM method_usage_pg
         WHERE program_schedule_id IS NOT NULL
         GROUP BY program_schedule_id
      ) mu ON mu.program_schedule_id = s.id
      WHERE p.user_id = $1
        AND p.status IN ('Actief', 'Gepland')
        AND s.session_date IS NOT NULL
      ORDER BY s.session_date ASC, s.id ASC`,
    [userId]
  )

  return result.rows
}

function getUpcomingDatesForSchedule(scheduleDays: string[], today: string, lookAheadDays: number): string[] {
  const DUTCH_DAYS = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"]
  const dates: string[] = []
  const start = new Date(today + "T00:00:00")

  for (let i = 0; i < lookAheadDays; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dayName = DUTCH_DAYS[d.getDay()]
    if (scheduleDays.includes(dayName)) {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const dd = String(d.getDate()).padStart(2, "0")
      dates.push(`${yyyy}-${mm}-${dd}`)
    }
  }
  return dates
}

function buildPersonalGoalPayload(input: {
  language: "nl" | "en" | "fr"
  goalName: string
  reminderDate: string
  personalGoalId: string
}): NotificationJobPayload {
  if (input.language === "en") {
    return {
      title: "Personal goal reminder",
      body: `Today is a planned day for: ${input.goalName}`,
      targetUrl: "/",
      mode: "personal_goal",
      reminderDate: input.reminderDate,
      personalGoalId: input.personalGoalId,
      personalGoalName: input.goalName
    }
  }
  if (input.language === "fr") {
    return {
      title: "Rappel objectif personnel",
      body: `Aujourd'hui est un jour prevu pour : ${input.goalName}`,
      targetUrl: "/",
      mode: "personal_goal",
      reminderDate: input.reminderDate,
      personalGoalId: input.personalGoalId,
      personalGoalName: input.goalName
    }
  }
  return {
    title: "Herinnering persoonlijk doel",
    body: `Vandaag is een geplande dag voor: ${input.goalName}`,
    targetUrl: "/",
    mode: "personal_goal",
    reminderDate: input.reminderDate,
    personalGoalId: input.personalGoalId,
    personalGoalName: input.goalName
  }
}

function buildJobCandidate(input: {
  userId: string
  mode: "session" | "daily_summary" | "personal_goal"
  reminderDate: string
  programId?: string
  programScheduleId?: string
  personalGoalId?: string
  leadMinutes: number
  preferredTimeLocal: string
  timezone: string
  quietHoursStart: string
  quietHoursEnd: string
  payload: NotificationJobPayload
  dedupeKey: string
}): NotificationJobCandidate {
  const baseLocal = zonedDateTimeToUtc(input.reminderDate, input.preferredTimeLocal, input.timezone)
  const fireAt = addMinutes(baseLocal, -input.leadMinutes)
  const fireLocalTime = formatTimeInTimeZone(fireAt, input.timezone)
  const isQuiet = isTimeInsideQuietHours(fireLocalTime, input.quietHoursStart, input.quietHoursEnd)

  return {
    userId: input.userId,
    programId: input.programId,
    programScheduleId: input.programScheduleId,
    personalGoalId: input.personalGoalId,
    reminderDate: input.reminderDate,
    mode: input.mode,
    fireAt,
    payload: input.payload,
    dedupeKey: input.dedupeKey,
    status: isQuiet ? "skipped_quiet_hours" : "pending"
  }
}

export async function syncNotificationJobsForUser(userId: string): Promise<PlannerResult | null> {
  const preferences = await getNotificationPreferences(userId)
  if (!preferences) return null

  if (!preferences.enabled) {
    await cancelNotificationJobsForUser(userId)
    return {
      userId,
      generated: 0,
      reminderMode: preferences.reminderMode
    }
  }

  const language = isSupportedLocaleLanguage(await getUserLanguageCode(userId))
  const timezone = resolveTimeZone(preferences.timezone)
  const today = formatDateInTimeZone(new Date(), timezone)
  const sessions = await listSchedulableSessionsForUser(userId)

  const remaining = sessions.filter((session) => {
    if (session.session_date < today) return false
    if (session.planned_methods <= 0) return false
    return session.completed_methods < session.planned_methods
  })

  const jobs: NotificationJobCandidate[] = []

  if (preferences.reminderMode === "session" || preferences.reminderMode === "both") {
    for (const session of remaining) {
      const payload = buildSessionPayload({
        language,
        reminderDate: session.session_date,
        programId: session.program_id,
        programScheduleId: session.program_schedule_id
      })

      jobs.push(
        buildJobCandidate({
          userId,
          mode: "session",
          reminderDate: session.session_date,
          programId: session.program_id,
          programScheduleId: session.program_schedule_id,
          leadMinutes: preferences.leadMinutes,
          preferredTimeLocal: preferences.preferredTimeLocal,
          timezone,
          quietHoursStart: preferences.quietHoursStart,
          quietHoursEnd: preferences.quietHoursEnd,
          payload,
          dedupeKey: `session:${session.program_schedule_id}:user:${userId}:lead:${preferences.leadMinutes}`
        })
      )
    }
  }

  if (preferences.reminderMode === "daily_summary" || preferences.reminderMode === "both") {
    const countByDate = new Map<string, number>()
    for (const session of remaining) {
      countByDate.set(session.session_date, (countByDate.get(session.session_date) || 0) + 1)
    }

    for (const [reminderDate, sessionCount] of countByDate.entries()) {
      const payload = buildDailyPayload({
        language,
        reminderDate,
        sessionCount
      })

      jobs.push(
        buildJobCandidate({
          userId,
          mode: "daily_summary",
          reminderDate,
          leadMinutes: preferences.leadMinutes,
          preferredTimeLocal: preferences.preferredTimeLocal,
          timezone,
          quietHoursStart: preferences.quietHoursStart,
          quietHoursEnd: preferences.quietHoursEnd,
          payload,
          dedupeKey: `daily:user:${userId}:date:${reminderDate}:lead:${preferences.leadMinutes}`
        })
      )
    }
  }

  // Personal goal reminders
  const scheduledGoals = await listScheduledPersonalGoalsForUser(userId)
  for (const goal of scheduledGoals) {
    const upcomingDates = getUpcomingDatesForSchedule(goal.scheduleDays, today, 14)
    for (const reminderDate of upcomingDates) {
      const payload = buildPersonalGoalPayload({
        language,
        goalName: goal.name,
        reminderDate,
        personalGoalId: goal.id
      })
      jobs.push(
        buildJobCandidate({
          userId,
          mode: "personal_goal",
          reminderDate,
          leadMinutes: preferences.leadMinutes,
          preferredTimeLocal: preferences.preferredTimeLocal,
          timezone,
          quietHoursStart: preferences.quietHoursStart,
          quietHoursEnd: preferences.quietHoursEnd,
          payload,
          dedupeKey: `pgoal:${goal.id}:user:${userId}:date:${reminderDate}:lead:${preferences.leadMinutes}`
        })
      )
    }
  }

  await upsertNotificationJobs(jobs)
  await cancelNotificationJobsNotInSet(
    userId,
    jobs.map((job) => job.dedupeKey)
  )

  return {
    userId,
    generated: jobs.length,
    reminderMode: preferences.reminderMode
  }
}

export async function syncNotificationJobsForAllUsers(): Promise<number> {
  const userIds = await listUsersForNotificationPlanning()
  let processed = 0
  for (const userId of userIds) {
    await syncNotificationJobsForUser(userId)
    processed += 1
  }
  return processed
}
