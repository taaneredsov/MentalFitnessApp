import { getProgressToNextLevel, formatPoints } from "@/lib/rewards-utils"

interface LevelProgressProps {
  totalPoints: number
  level: number
}

/**
 * Circular progress ring showing level and progress to next level
 */
export function LevelProgress({ totalPoints, level }: LevelProgressProps) {
  const progress = getProgressToNextLevel(totalPoints)
  const { currentLevel, nextLevel, pointsInLevel, pointsNeeded, progressPercent } = progress

  // SVG circle parameters
  const size = 120
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Circular Progress */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="text-primary transition-all duration-500"
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold">{level}</span>
          <span className="text-xs text-muted-foreground">Niveau</span>
        </div>
      </div>

      {/* Level title and progress */}
      <div className="text-center">
        <p className="font-semibold text-lg">{currentLevel.title}</p>
        {nextLevel ? (
          <p className="text-sm text-muted-foreground">
            {formatPoints(pointsInLevel)} / {formatPoints(pointsNeeded)} naar {nextLevel.title}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Maximum niveau bereikt!
          </p>
        )}
      </div>
    </div>
  )
}
