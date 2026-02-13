import { useEffect, useRef } from "react"

const SW_CHECK_INTERVAL = 60_000 // Check for updates every 60 seconds

/**
 * Invisible component that ensures PWA users always get the latest version.
 *
 * Strategy:
 * 1. On mount + every 60s + every time the app regains focus → call registration.update()
 * 2. When a new SW is found and reaches "installed" state → tell it to skipWaiting
 * 3. When the new SW takes control (controllerchange) → reload to load new assets
 *
 * Because sw.js already calls self.skipWaiting() + clientsClaim() unconditionally,
 * step 2 is a belt-and-suspenders safety net.
 */
export function PWAUpdatePrompt() {
  const reloadingRef = useRef(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    let intervalId: ReturnType<typeof setInterval>

    const triggerUpdate = (registration: ServiceWorkerRegistration) => {
      registration.update().catch(() => {
        // Network error - silently ignore, will retry on next interval/focus
      })
    }

    const activateWaitingWorker = (worker: ServiceWorker) => {
      worker.postMessage({ type: "SKIP_WAITING" })
    }

    const setup = async () => {
      const registration = await navigator.serviceWorker.ready

      // If there's already a waiting worker, activate it immediately
      if (registration.waiting) {
        activateWaitingWorker(registration.waiting)
      }

      // When a new worker is found installing, watch for it to become installed
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New SW is installed but waiting — tell it to activate now
            activateWaitingWorker(newWorker)
          }
        })
      })

      // Periodic check
      intervalId = setInterval(() => triggerUpdate(registration), SW_CHECK_INTERVAL)

      // Check on app focus (user switches back to PWA)
      const handleVisibility = () => {
        if (document.visibilityState === "visible") {
          triggerUpdate(registration)
        }
      }
      document.addEventListener("visibilitychange", handleVisibility)

      // Store for cleanup
      return handleVisibility
    }

    let visibilityHandler: ((this: Document, ev: Event) => void) | undefined

    setup().then((handler) => {
      visibilityHandler = handler
    })

    // When a new SW takes control → reload to pick up new assets
    const handleControllerChange = () => {
      if (reloadingRef.current) return
      reloadingRef.current = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)

    return () => {
      clearInterval(intervalId)
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler)
      }
    }
  }, [])

  // This component renders nothing — updates happen automatically
  return null
}
