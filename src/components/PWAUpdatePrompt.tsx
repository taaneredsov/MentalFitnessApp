import { useState, useEffect, useRef } from "react"
import { RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const UPDATE_REQUESTED_KEY = "pwa_update_requested"

/**
 * Shows a toast banner when a new service worker is waiting
 * Allows user to update the app immediately
 */
export function PWAUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [updating, setUpdating] = useState(false)
  const reloadHandledRef = useRef(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    const checkForWaitingWorker = async () => {
      const registration = await navigator.serviceWorker.ready

      // Check if there's already a waiting worker
      if (registration.waiting) {
        setWaitingWorker(registration.waiting)
        setShowPrompt(true)
      }

      // Listen for new workers installing
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New content is available, show update prompt
            setWaitingWorker(newWorker)
            setShowPrompt(true)
          }
        })
      })
    }

    checkForWaitingWorker()

    // Listen for controller change (new SW took over)
    const handleControllerChange = () => {
      // Prevent reload loops (e.g. when DevTools "Update on reload" is enabled).
      // Reload only when the user explicitly requested an in-app update.
      const updateRequested = sessionStorage.getItem(UPDATE_REQUESTED_KEY) === "1"
      if (!updateRequested || reloadHandledRef.current) {
        return
      }

      reloadHandledRef.current = true
      sessionStorage.removeItem(UPDATE_REQUESTED_KEY)
      console.log("[PWAUpdate] New service worker activated after user update, reloading once...")
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
    }
  }, [])

  const handleUpdate = () => {
    if (!waitingWorker) return

    setUpdating(true)
    sessionStorage.setItem(UPDATE_REQUESTED_KEY, "1")
    console.log("[PWAUpdate] Sending SKIP_WAITING message to service worker")

    // Tell the waiting worker to take over
    waitingWorker.postMessage({ type: "SKIP_WAITING" })
  }

  const handleDismiss = () => {
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium">Update beschikbaar</p>
          <p className="text-sm opacity-90">Nieuwe versie klaar om te installeren</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleUpdate}
            disabled={updating}
            variant="secondary"
            size="sm"
          >
            {updating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              "Update"
            )}
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-full hover:bg-primary-foreground/20"
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
