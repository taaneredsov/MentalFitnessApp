import {
  claimDueNotificationJobs,
  insertNotificationDeliveryLog,
  markNotificationJobDeadLetter,
  markNotificationJobRetry,
  markNotificationJobSent,
  markNotificationJobSkippedQuietHours
} from "../repos/notification-job-repo.js"
import {
  listActivePushSubscriptionsByUser,
  markPushSubscriptionError,
  markPushSubscriptionExpired,
  markPushSubscriptionSuccess
} from "../repos/notification-subscription-repo.js"
import { getNotificationPreferences } from "../repos/notification-preference-repo.js"
import { isWebPushConfigured, sendWebPushToSubscription } from "./web-push.js"
import { formatTimeInTimeZone, isTimeInsideQuietHours } from "./time.js"
import { syncNotificationJobsForAllUsers } from "./planner.js"

const NOTIFICATION_BATCH_SIZE = Number(process.env.NOTIFICATION_BATCH_SIZE || 20)
const NOTIFICATION_MAX_RETRIES = Number(process.env.NOTIFICATION_MAX_RETRIES || 6)
const NOTIFICATION_RETRY_BASE_SECONDS = Number(process.env.NOTIFICATION_RETRY_BASE_SECONDS || 5)

function getErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const code = (error as { statusCode?: unknown }).statusCode
  if (typeof code === "number") return code
  return undefined
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function isRetryableStatus(statusCode: number | undefined): boolean {
  if (!statusCode) return true
  if (statusCode >= 500) return true
  if (statusCode === 408 || statusCode === 429) return true
  return false
}

function computeRetryDelaySeconds(attemptCount: number): number {
  const multiplier = Math.max(1, attemptCount)
  return NOTIFICATION_RETRY_BASE_SECONDS * multiplier * multiplier
}

async function shouldSkipForQuietHours(userId: string, fireAtIso: string): Promise<boolean> {
  const preferences = await getNotificationPreferences(userId)
  if (!preferences) return false

  const fireAt = new Date(fireAtIso)
  const localTime = formatTimeInTimeZone(fireAt, preferences.timezone)
  return isTimeInsideQuietHours(localTime, preferences.quietHoursStart, preferences.quietHoursEnd)
}

async function processNotificationJob(job: Awaited<ReturnType<typeof claimDueNotificationJobs>>[number]): Promise<void> {
  if (await shouldSkipForQuietHours(job.userId, job.fireAt)) {
    await markNotificationJobSkippedQuietHours(job.id)
    return
  }

  const subscriptions = await listActivePushSubscriptionsByUser(job.userId)
  if (subscriptions.length === 0) {
    await markNotificationJobDeadLetter(job.id, "Geen actieve push abonnementen")
    return
  }

  let successCount = 0
  let hasRetryableError = false
  const errors: string[] = []

  for (const subscription of subscriptions) {
    try {
      await sendWebPushToSubscription(
        {
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth
        },
        job.payload
      )

      await markPushSubscriptionSuccess(subscription.id)
      await insertNotificationDeliveryLog({
        jobId: job.id,
        subscriptionId: subscription.id,
        success: true
      })
      successCount += 1
    } catch (error) {
      const statusCode = getErrorStatusCode(error)
      const message = getErrorMessage(error)
      errors.push(`${statusCode || "n/a"}:${message}`)
      hasRetryableError = hasRetryableError || isRetryableStatus(statusCode)

      await insertNotificationDeliveryLog({
        jobId: job.id,
        subscriptionId: subscription.id,
        success: false,
        statusCode,
        errorMessage: message
      })

      if (statusCode === 404 || statusCode === 410) {
        await markPushSubscriptionExpired(subscription.id, message)
      } else {
        await markPushSubscriptionError(subscription.id, message)
      }
    }
  }

  if (successCount > 0) {
    await markNotificationJobSent(job.id)
    return
  }

  const message = errors.join(" | ").slice(0, 1000) || "Notification send failed"
  if (hasRetryableError && job.attemptCount < NOTIFICATION_MAX_RETRIES) {
    const delaySeconds = computeRetryDelaySeconds(job.attemptCount)
    await markNotificationJobRetry(job.id, delaySeconds, message)
    return
  }

  await markNotificationJobDeadLetter(job.id, message)
}

export async function processNotificationBatch(limit = NOTIFICATION_BATCH_SIZE): Promise<number> {
  if (!isWebPushConfigured()) {
    return 0
  }

  const jobs = await claimDueNotificationJobs(limit)
  if (jobs.length === 0) return 0

  for (const job of jobs) {
    await processNotificationJob(job)
  }

  return jobs.length
}

export async function runNotificationReconcile(): Promise<number> {
  return syncNotificationJobsForAllUsers()
}
