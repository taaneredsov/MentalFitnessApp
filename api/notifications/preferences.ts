import type { Request, Response } from "express"
import { z } from "zod"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { getNotificationPreferences, upsertNotificationPreferences } from "../_lib/repos/notification-preference-repo.js"
import { syncNotificationJobsForUser } from "../_lib/notifications/planner.js"
import { getWebPushPublicKey, isWebPushConfigured } from "../_lib/notifications/web-push.js"

const reminderModeSchema = z.enum(["session", "daily_summary", "both"])

const updatePreferencesSchema = z.object({
  enabled: z.boolean().optional(),
  reminderMode: reminderModeSchema.optional(),
  leadMinutes: z.number().int().min(0).max(1440).optional(),
  preferredTimeLocal: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().min(1).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional()
})

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET" && req.method !== "PATCH") {
    return sendError(res, "Method not allowed", 405)
  }

  if (!isPostgresConfigured()) {
    return sendError(res, "Notifications require DATABASE_URL", 503)
  }

  try {
    const auth = await requireAuth(req)

    if (req.method === "PATCH") {
      const body = updatePreferencesSchema.parse(parseBody(req))
      const updated = await upsertNotificationPreferences({
        userId: auth.userId,
        enabled: body.enabled,
        reminderMode: body.reminderMode,
        leadMinutes: body.leadMinutes,
        preferredTimeLocal: body.preferredTimeLocal,
        timezone: body.timezone,
        quietHoursStart: body.quietHoursStart,
        quietHoursEnd: body.quietHoursEnd
      })

      if (!updated) {
        return sendError(res, "User not found", 404)
      }

      await syncNotificationJobsForUser(auth.userId)

      return sendSuccess(res, {
        ...updated,
        webPushConfigured: isWebPushConfigured(),
        vapidPublicKey: getWebPushPublicKey()
      })
    }

    const preferences = await getNotificationPreferences(auth.userId)
    if (!preferences) {
      return sendError(res, "User not found", 404)
    }

    return sendSuccess(res, {
      ...preferences,
      webPushConfigured: isWebPushConfigured(),
      vapidPublicKey: getWebPushPublicKey()
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
