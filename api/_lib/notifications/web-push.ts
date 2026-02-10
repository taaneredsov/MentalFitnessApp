import webpush from "web-push"
import type { NotificationJobPayload } from "./types.js"

interface PushConfig {
  publicKey: string
  privateKey: string
  subject: string
}

interface StoredSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

let configured = false

function readPushConfig(): PushConfig | null {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY
  const subject = process.env.WEB_PUSH_SUBJECT || "mailto:support@example.com"

  if (!publicKey || !privateKey) {
    return null
  }

  return {
    publicKey,
    privateKey,
    subject
  }
}

function ensureConfigured(): PushConfig {
  const config = readPushConfig()
  if (!config) {
    throw new Error("WEB_PUSH_VAPID_PUBLIC_KEY and WEB_PUSH_VAPID_PRIVATE_KEY are required")
  }

  if (!configured) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
    configured = true
  }

  return config
}

export function isWebPushConfigured(): boolean {
  return !!readPushConfig()
}

export function getWebPushPublicKey(): string | null {
  return readPushConfig()?.publicKey || null
}

export async function sendWebPushToSubscription(
  subscription: StoredSubscription,
  payload: NotificationJobPayload
): Promise<{ statusCode?: number }> {
  ensureConfigured()

  const result = await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    },
    JSON.stringify(payload),
    {
      TTL: 60
    }
  )

  return {
    statusCode: result.statusCode
  }
}
