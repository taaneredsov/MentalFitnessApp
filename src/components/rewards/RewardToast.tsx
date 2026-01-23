import { useState, useEffect } from "react"
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
 * Toast notification for points awarded, badges earned, level ups, or milestones
 */
export function RewardToast({ pointsAwarded, newBadges = [], levelUp, newLevel, milestone, onClose }: RewardToastProps) {
  const [isVisible, setIsVisible] = useState(true)

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
