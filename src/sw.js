/// <reference lib="webworker" />
/* global self */

import { clientsClaim } from "workbox-core"
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching"
import { registerRoute } from "workbox-routing"
import { NetworkFirst } from "workbox-strategies"
import { ExpirationPlugin } from "workbox-expiration"

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST || [])

registerRoute(
  ({ url }) => /^https:\/\/api\.airtable\.com\/.*/i.test(url.href),
  new NetworkFirst({
    cacheName: "airtable-api-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60
      })
    ]
  })
)

self.addEventListener("push", (event) => {
  if (!event.data) return

  let data = {
    title: "Nieuwe herinnering",
    body: "Je activiteit staat klaar.",
    targetUrl: "/"
  }

  try {
    const parsed = event.data.json()
    data = {
      title: parsed.title || data.title,
      body: parsed.body || data.body,
      targetUrl: parsed.targetUrl || data.targetUrl
    }
  } catch {
    // Fallback to defaults when payload is malformed.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      data: {
        url: data.targetUrl
      }
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const windowClient = client
        if ("focus" in windowClient && windowClient.url.includes(self.location.origin)) {
          windowClient.navigate(targetUrl)
          return windowClient.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }

      return undefined
    })
  )
})
