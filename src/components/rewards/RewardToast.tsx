import { useState, useEffect } from "react"
import confetti from "canvas-confetti"
import { Star, Trophy, Target } from "lucide-react"
import { getBadgeInfo, getMilestoneDisplayText, type MilestoneThreshold } from "@/lib/rewards-utils"

interface RewardToastProps {
  pointsAwarded: number
  newBadges?: string[]
  levelUp?: boolean
  newLevel?: number
  milestone?: number  // Milestone reached (25, 50, 75, 100)
  onClose?: () => void
}

/**
 * Fire confetti celebration for milestones
 */
function fireCelebration(intensity: "small" | "medium" | "large" = "medium") {
  const particleCount = intensity === "small" ? 50 : intensity === "large" ? 200 : 100
  const spread = intensity === "small" ? 50 : intensity === "large" ? 100 : 70

  // Fire from the left
  confetti({
    particleCount,
    spread,
    origin: { x: 0.2, y: 0.8 },
    colors: ["#22c55e", "#16a34a", "#15803d", "#fbbf24", "#f59e0b"]
  })

  // Fire from the right
  confetti({
    particleCount,
    spread,
    origin: { x: 0.8, y: 0.8 },
    colors: ["#22c55e", "#16a34a", "#15803d", "#fbbf24", "#f59e0b"]
  })
}

/**
 * Toast notification for points awarded, badges earned, level ups, or milestones
 */
export function RewardToast({ pointsAwarded, newBadges = [], levelUp, newLevel, milestone, onClose }: RewardToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  // Trigger confetti for milestones or level ups
  useEffect(() => {
    if (milestone === 100 || levelUp) {
      // Big celebration for 100% completion or level up
      fireCelebration("large")
    } else if (milestone) {
      // Medium celebration for other milestones (25%, 50%, 75%)
      fireCelebration("medium")
    }
  }, [milestone, levelUp])

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose?.()
    }, 3000)

    return () => clearTimeout(timer)
  }, [onClose])

  if (!isVisible) return null

  // Determine what to display, prioritizing more significant events
  const renderContent = () => {
    if (levelUp) {
      return (
        <>
          <Trophy className="h-5 w-5" />
          <span className="font-semibold">Niveau {newLevel}!</span>
        </>
      )
    }

    if (milestone) {
      const displayText = getMilestoneDisplayText(milestone as MilestoneThreshold)
      return (
        <>
          <Target className="h-5 w-5" />
          <span className="font-semibold">{displayText} +{pointsAwarded} pts</span>
        </>
      )
    }

    if (newBadges.length > 0) {
      return (
        <>
          <Star className="h-5 w-5" />
          <span className="font-semibold">
            {getBadgeInfo(newBadges[0])?.name || "Badge"} verdiend!
          </span>
        </>
      )
    }

    return (
      <>
        <Star className="h-5 w-5" />
        <span className="font-semibold">+{pointsAwarded} punten</span>
      </>
    )
  }

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg flex items-center gap-3">
        {renderContent()}
      </div>
    </div>
  )
}

/**
 * Simple inline points indicator for habit completion
 */
export function PointsIndicator({ points, show }: { points: number; show: boolean }) {
  if (!show) return null

  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary animate-in fade-in zoom-in duration-300">
      +{points}
    </span>
  )
}
