import { useUserRewards } from "@/hooks/queries"
import { formatPoints } from "@/lib/rewards-utils"

/**
 * Small pill showing streak and points in the header
 * Format: 🔥12 ⭐340
 */
export function PointsDisplay() {
  const { data: rewards, isLoading } = useUserRewards()

  if (isLoading || !rewards) {
    return null
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted/50 text-sm font-medium">
      {rewards.currentStreak > 0 && (
        <span className="flex items-center gap-0.5">
          <span>🔥</span>
          <span>{rewards.currentStreak}</span>
        </span>
      )}
      <span className="flex items-center gap-0.5">
        <span>⭐</span>
        <span>{formatPoints(rewards.totalPoints)}</span>
      </span>
    </div>
  )
}
