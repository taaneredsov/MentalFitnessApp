import { useUserRewards } from "@/hooks/queries"

/**
 * Small pill showing streak in the header
 * Format: 🔥12
 * Note: Total points removed - scores now shown in ScoreWidgets on HomePage
 */
export function PointsDisplay() {
  const { data: rewards, isLoading } = useUserRewards()

  if (isLoading || !rewards) {
    return null
  }

  // Only show if user has a streak
  if (rewards.currentStreak === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted/50 text-sm font-medium">
      <span className="flex items-center gap-0.5">
        <span>🔥</span>
        <span>{rewards.currentStreak}</span>
      </span>
    </div>
  )
}
