import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import PullToRefresh from "pulltorefreshjs"

interface PullToRefreshWrapperProps {
  onRefresh: () => Promise<void>
  children: ReactNode
}

export function PullToRefreshWrapper({ onRefresh, children }: PullToRefreshWrapperProps) {
  const containerId = useRef(`ptr-container-${Math.random().toString(36).slice(2, 9)}`)
  const instanceRef = useRef<ReturnType<typeof PullToRefresh.init> | null>(null)

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    instanceRef.current = PullToRefresh.init({
      mainElement: `#${containerId.current}`,
      triggerElement: `#${containerId.current}`,
      onRefresh: async () => {
        // Trigger haptic feedback if available
        if (navigator.vibrate) {
          navigator.vibrate(10)
        }
        await onRefresh()
      },
      instructionsPullToRefresh: "Trek naar beneden om te verversen",
      instructionsReleaseToRefresh: "Laat los om te verversen",
      instructionsRefreshing: "Verversen...",
      distThreshold: prefersReducedMotion ? 40 : 60,
      distMax: prefersReducedMotion ? 60 : 80,
      distReload: prefersReducedMotion ? 40 : 50,
      refreshTimeout: 300,
    })

    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy()
        instanceRef.current = null
      }
    }
  }, [onRefresh])

  return (
    <div id={containerId.current} className="min-h-screen">
      {children}
    </div>
  )
}
