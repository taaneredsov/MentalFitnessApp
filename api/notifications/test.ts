import type { Request, Response } from "express"
import { z } from "zod"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { isWebPushConfigured, sendWebPushToSubscription } from "../_lib/notifications/web-push.js"
import { listActivePushSubscriptionsByUser } from "../_lib/repos/notification-subscription-repo.js"

const testSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(240).optional()
})

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  if (!isPostgresConfigured()) {
    return sendError(res, "Notifications require DATABASE_URL", 503)
  }

  try {
    if (process.env.NODE_ENV === "production" && process.env.PUSH_NOTIFICATIONS_TEST_MODE !== "true") {
      return sendError(res, "Notification test endpoint disabled in production", 403)
    }

    const auth = await requireAuth(req)
    const body = testSchema.parse(parseBody(req))

    if (!isWebPushConfigured()) {
      return sendError(res, "Web push is not configured", 503)
    }

    const subscriptions = await listActivePushSubscriptionsByUser(auth.userId)
    if (subscriptions.length === 0) {
      return sendError(res, "Geen actieve push abonnementen", 400)
    }

    let sent = 0
    const errors: string[] = []

    for (const subscription of subscriptions) {
      try {
        await sendWebPushToSubscription(
          {
            endpoint: subscription.endpoint,
            p256dh: subscription.p256dh,
            auth: subscription.auth
          },
          {
            title: body.title || "Test notificatie",
            body: body.body || "Push notificaties werken correct.",
            targetUrl: "/",
            mode: "session",
            reminderDate: new Date().toISOString().split("T")[0]
          }
        )
        sent += 1
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }
    }

    return sendSuccess(res, {
      sent,
      failed: subscriptions.length - sent,
      errors
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
