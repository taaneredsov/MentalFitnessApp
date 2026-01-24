import { useState } from "react"
import { Trash2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function DebugPanel() {
  const [clearing, setClearing] = useState(false)

  const clearAllCaches = async () => {
    setClearing(true)
    try {
      // Clear all browser caches
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))

      // Unregister all service workers
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(reg => reg.unregister()))

      // Force reload from server
      window.location.reload()
    } catch (error) {
      console.error("Failed to clear caches:", error)
      setClearing(false)
    }
  }

  return (
    <div className="fixed bottom-24 right-4 z-50">
      <Button
        onClick={clearAllCaches}
        disabled={clearing}
        variant="destructive"
        size="sm"
        className="shadow-lg"
      >
        {clearing ? (
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Trash2 className="h-4 w-4 mr-2" />
        )}
        {clearing ? "Clearing..." : "Clear Cache"}
      </Button>
    </div>
  )
}
