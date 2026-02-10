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
  webPushConfigured: boolean
  vapidPublicKey: string | null
}
