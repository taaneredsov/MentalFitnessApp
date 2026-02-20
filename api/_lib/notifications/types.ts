export type ReminderMode = "session" | "daily_summary" | "both"

export interface NotificationPreferences {
  userId: string
  enabled: boolean
  reminderMode: ReminderMode
  leadMinutes: number
  preferredTimeLocal: string
  timezone: string
  quietHoursStart: string
  quietHoursEnd: string
}

export interface NotificationJobPayload {
  title: string
  body: string
  targetUrl: string
  mode: "session" | "daily_summary" | "personal_goal"
  reminderDate: string
  programId?: string
  programScheduleId?: string
  sessionCount?: number
  personalGoalId?: string
  personalGoalName?: string
}
