import { useState, useEffect } from "react"
import { Trash2, RefreshCw, ChevronDown, ChevronUp, Zap, Database, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQueryClient } from "@tanstack/react-query"
import { getVersionInfo } from "@/hooks/useVersionCheck"

interface CacheStatus {
  sw: "active" | "waiting" | "none" | "unsupported"
  browserCaches: string[]
  rqQueries: {
    total: number
    stale: number
    active: number
  }
}

export function DebugPanel() {
  const [expanded, setExpanded] = useState(false)
  const [clearing, setClearing] = useState<string | null>(null)
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null)
  const queryClient = useQueryClient()
  const versionInfo = getVersionInfo()

  // Refresh cache status
  const refreshStatus = async () => {
    const status: CacheStatus = {
      sw: "unsupported",
      browserCaches: [],
      rqQueries: { total: 0, stale: 0, active: 0 }
    }

    // Service Worker status
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration?.waiting) {
          status.sw = "waiting"
        } else if (registration?.active) {
          status.sw = "active"
        } else {
          status.sw = "none"
        }
      } catch {
        status.sw = "none"
      }
    }

    // Browser caches
    try {
      status.browserCaches = await caches.keys()
    } catch {
      status.browserCaches = []
    }

    // React Query status
    const queryCache = queryClient.getQueryCache()
    const queries = queryCache.getAll()
    status.rqQueries.total = queries.length
    status.rqQueries.stale = queries.filter(q => q.isStale()).length
    status.rqQueries.active = queries.filter(q => q.isActive()).length

    setCacheStatus(status)
  }

  useEffect(() => {
    refreshStatus()
    const interval = setInterval(refreshStatus, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient])

  const clearReactQuery = async () => {
    setClearing("rq")
    try {
      queryClient.clear()
      await refreshStatus()
    } finally {
      setClearing(null)
    }
  }

  const clearServiceWorker = async () => {
    setClearing("sw")
    try {
      const registrations = await navigator.serviceWorker?.getRegistrations() || []
      await Promise.all(registrations.map(reg => reg.unregister()))
      await refreshStatus()
    } finally {
      setClearing(null)
    }
  }

  const forceUpdate = async () => {
    setClearing("update")
    try {
      const registration = await navigator.serviceWorker?.ready
      await registration?.update()
      await refreshStatus()
    } finally {
      setClearing(null)
    }
  }

  const clearAllCaches = async () => {
    setClearing("all")
    try {
      // Clear React Query
      queryClient.clear()

      // Clear all browser caches
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))

      // Unregister all service workers
      const registrations = await navigator.serviceWorker?.getRegistrations() || []
      await Promise.all(registrations.map(reg => reg.unregister()))

      // Force reload from server
      window.location.reload()
    } catch (error) {
      console.error("Failed to clear caches:", error)
      setClearing(null)
    }
  }

  const swStatusColor = {
    active: "text-green-500",
    waiting: "text-yellow-500",
    none: "text-gray-500",
    unsupported: "text-gray-400"
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 max-w-xs">
      {/* Collapsed view */}
      <div className="bg-card border rounded-lg shadow-lg overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <span className="text-xs font-mono text-muted-foreground">
            v{versionInfo.version} ({versionInfo.buildHash})
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Expanded view */}
        {expanded && (
          <div className="border-t p-3 space-y-3">
            {/* Version Info */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Build Info</div>
              <div className="text-xs font-mono space-y-0.5">
                <div>Version: {versionInfo.version}</div>
                <div>Build: {versionInfo.buildHash}</div>
                <div>Time: {new Date(versionInfo.buildTime).toLocaleString()}</div>
              </div>
            </div>

            {/* Cache Status */}
            {cacheStatus && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  Cache Status
                  <button onClick={refreshStatus} className="p-1 hover:bg-muted rounded">
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3 w-3" />
                    <span>SW: </span>
                    <span className={swStatusColor[cacheStatus.sw]}>{cacheStatus.sw}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="h-3 w-3" />
                    <span>Browser: {cacheStatus.browserCaches.length} caches</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-3 w-3" />
                    <span>RQ: {cacheStatus.rqQueries.total} queries ({cacheStatus.rqQueries.stale} stale)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={clearReactQuery}
                disabled={clearing !== null}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                {clearing === "rq" ? (
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Zap className="h-3 w-3 mr-1" />
                )}
                Clear RQ
              </Button>

              <Button
                onClick={clearServiceWorker}
                disabled={clearing !== null}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                {clearing === "sw" ? (
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Globe className="h-3 w-3 mr-1" />
                )}
                Clear SW
              </Button>

              <Button
                onClick={forceUpdate}
                disabled={clearing !== null}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                {clearing === "update" ? (
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Check Update
              </Button>

              <Button
                onClick={clearAllCaches}
                disabled={clearing !== null}
                variant="destructive"
                size="sm"
                className="text-xs"
              >
                {clearing === "all" ? (
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-3 w-3 mr-1" />
                )}
                Clear All
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
