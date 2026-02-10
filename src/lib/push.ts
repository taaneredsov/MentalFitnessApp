export interface BrowserPushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported"
  return Notification.permission
}

async function getActiveServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.ready
  return registration
}

function toBrowserSubscription(subscription: PushSubscription): BrowserPushSubscription {
  const raw = subscription.toJSON()
  return {
    endpoint: raw.endpoint || subscription.endpoint,
    keys: {
      p256dh: raw.keys?.p256dh || "",
      auth: raw.keys?.auth || ""
    }
  }
}

export async function subscribeToPush(vapidPublicKey: string): Promise<BrowserPushSubscription> {
  if (!isPushSupported()) {
    throw new Error("Push notificaties worden niet ondersteund op dit toestel/deze browser")
  }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    throw new Error("Toestemming voor push notificaties werd niet gegeven")
  }

  const registration = await getActiveServiceWorkerRegistration()
  const existing = await registration.pushManager.getSubscription()
  if (existing) {
    return toBrowserSubscription(existing)
  }

  const keyBytes = urlBase64ToUint8Array(vapidPublicKey)
  const applicationServerKey = Uint8Array.from(keyBytes)

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey
  })

  return toBrowserSubscription(subscription)
}

export async function getCurrentPushSubscription(): Promise<BrowserPushSubscription | null> {
  if (!isPushSupported()) return null

  const registration = await getActiveServiceWorkerRegistration()
  const existing = await registration.pushManager.getSubscription()
  if (!existing) return null
  return toBrowserSubscription(existing)
}

export async function unsubscribeFromPush(): Promise<BrowserPushSubscription | null> {
  if (!isPushSupported()) return null

  const registration = await getActiveServiceWorkerRegistration()
  const existing = await registration.pushManager.getSubscription()
  if (!existing) return null

  const data = toBrowserSubscription(existing)
  await existing.unsubscribe()
  return data
}
