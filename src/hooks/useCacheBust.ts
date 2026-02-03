import { useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"

type BustType = "all" | "sw" | "rq"

/**
 * Hook to clear caches based on URL parameters
 * - ?bust=all - Clear SW + React Query + browser caches + reload
 * - ?bust=sw - Clear service worker only + reload
 * - ?bust=rq - Clear React Query only (no reload)
 */
export function useCacheBust() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    const bustType = searchParams.get("bust") as BustType | null
    if (!bustType) return

    const clearCaches = async () => {
      console.log(`[CacheBust] Clearing caches: ${bustType}`)

      try {
        if (bustType === "all" || bustType === "rq") {
          // Clear React Query cache
          queryClient.clear()
          console.log("[CacheBust] React Query cache cleared")
        }

        if (bustType === "all" || bustType === "sw") {
          // Clear all browser caches
          const cacheNames = await caches.keys()
          await Promise.all(cacheNames.map(name => caches.delete(name)))
          console.log(`[CacheBust] Browser caches cleared: ${cacheNames.join(", ")}`)

          // Unregister all service workers
          const registrations = await navigator.serviceWorker?.getRegistrations() || []
          await Promise.all(registrations.map(reg => reg.unregister()))
          console.log(`[CacheBust] Service workers unregistered: ${registrations.length}`)
        }

        // Remove the bust parameter to prevent loop
        const newParams = new URLSearchParams(searchParams)
        newParams.delete("bust")
        const newSearch = newParams.toString()
        const newPath = window.location.pathname + (newSearch ? `?${newSearch}` : "")

        if (bustType === "all" || bustType === "sw") {
          // Hard reload for SW changes
          window.location.replace(newPath)
        } else {
          // Soft navigation for RQ-only
          navigate(newPath, { replace: true })
          console.log("[CacheBust] Cache bust complete (no reload)")
        }
      } catch (error) {
        console.error("[CacheBust] Failed to clear caches:", error)
        // Still remove the parameter to prevent loop
        const newParams = new URLSearchParams(searchParams)
        newParams.delete("bust")
        setSearchParams(newParams, { replace: true })
      }
    }

    clearCaches()
  }, [searchParams, queryClient, navigate, setSearchParams])
}
