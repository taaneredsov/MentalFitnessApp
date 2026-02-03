import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

const VERSION_KEY = "app_version"
const BUILD_KEY = "app_build_hash"

/**
 * Hook to detect version changes and clear React Query cache
 * Stores version in localStorage and compares on each load
 */
export function useVersionCheck() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const currentVersion = __APP_VERSION__
    const currentBuild = __BUILD_HASH__

    const storedVersion = localStorage.getItem(VERSION_KEY)
    const storedBuild = localStorage.getItem(BUILD_KEY)

    const versionChanged = storedVersion !== currentVersion
    const buildChanged = storedBuild !== currentBuild

    if (versionChanged || buildChanged) {
      console.log(
        `[VersionCheck] Version changed: ${storedVersion} -> ${currentVersion}, ` +
        `Build: ${storedBuild} -> ${currentBuild}`
      )

      // Clear React Query cache on version change
      queryClient.clear()
      console.log("[VersionCheck] React Query cache cleared due to version change")

      // Store new version
      localStorage.setItem(VERSION_KEY, currentVersion)
      localStorage.setItem(BUILD_KEY, currentBuild)
    }
  }, [queryClient])
}

/**
 * Get current app version info for display
 */
export function getVersionInfo() {
  return {
    version: __APP_VERSION__,
    buildHash: __BUILD_HASH__,
    buildTime: __BUILD_TIME__
  }
}
