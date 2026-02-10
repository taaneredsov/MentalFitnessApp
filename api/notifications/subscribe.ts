import type { Request, Response } from "express"
import { z } from "zod"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { upsertPushSubscription, revokePushSubscription } from "../_lib/repos/notification-subscription-repo.js"
import { upsertNotificationPreferences } from "../_lib/repos/notification-preference-repo.js"
import { syncNotificationJobsForUser } from "../_lib/notifications/planner.js"

const subscribeSchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  }),
  timezone: z.string().optional()
})

const revokeSchema = z.object({
  endpoint: z.string().min(1)
})

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return sendError(res, "Method not allowed", 405)
  }

  if (!isPostgresConfigured()) {
    return sendError(res, "Notifications require DATABASE_URL", 503)
  }

  try {
    const auth = await requireAuth(req)

    if (req.method === "POST") {
      const body = subscribeSchema.parse(parseBody(req))
      const subscription = await upsertPushSubscription({
        userId: auth.userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: req.headers["user-agent"]
      })

      if (body.timezone) {
        await upsertNotificationPreferences({
          userId: auth.userId,
          timezone: body.timezone
        })
      }

      await syncNotificationJobsForUser(auth.userId)

      return sendSuccess(res, {
        id: subscription.id,
        endpoint: subscription.endpoint,
        status: subscription.status
      }, 201)
    }

    const body = revokeSchema.parse(parseBody(req))
    await revokePushSubscription(auth.userId, body.endpoint)
    await syncNotificationJobsForUser(auth.userId)

    return sendSuccess(res, { success: true })
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
