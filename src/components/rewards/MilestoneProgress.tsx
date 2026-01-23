import { CheckCircle2, Circle, Target } from "lucide-react"
import { PROGRAM_MILESTONES, getMilestoneDisplayText, type MilestoneThreshold } from "@/lib/rewards-utils"

interface MilestoneProgressProps {
  completedMethods: number
  totalMethods: number
  milestonesAwarded: string[]
}

/**
 * Visual milestone progress indicator for programs
 * Shows progress bar with milestone markers and achieved/upcoming milestones
 */
export function MilestoneProgress({ completedMethods, totalMethods, milestonesAwarded }: MilestoneProgressProps) {
  if (totalMethods === 0) return null

  const progressPercent = Math.min(100, Math.round((completedMethods / totalMethods) * 100))

  // Calculate points earned from milestones
  const pointsEarned = PROGRAM_MILESTONES
    .filter(m => milestonesAwarded.includes(String(m.threshold)))
    .reduce((sum, m) => sum + m.points, 0)

  // Find next milestone
  const nextMilestone = PROGRAM_MILESTONES.find(
    m => !milestonesAwarded.includes(String(m.threshold)) && progressPercent < m.threshold
  )

  return (
    <div className="space-y-3">
      {/* Progress bar with milestone markers */}
      <div className="relative">
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Milestone markers */}
        {PROGRAM_MILESTONES.map((milestone) => {
          const isAchieved = milestonesAwarded.includes(String(milestone.threshold))
          const isPassed = progressPercent >= milestone.threshold

          return (
            <div
              key={milestone.threshold}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${milestone.threshold}%` }}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  isAchieved
                    ? "bg-primary border-primary text-primary-foreground"
                    : isPassed
                    ? "bg-primary/50 border-primary/50"
                    : "bg-background border-muted-foreground/30"
                }`}
              >
                {isAchieved && <CheckCircle2 className="w-3 h-3" />}
              </div>
            </div>
          )
        })}
      </div>

      {/* Milestone labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>

      {/* Current progress and points */}
      <div className="flex items-center justify-between text-sm pt-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="font-medium">{progressPercent}% voltooid</span>
          <span className="text-muted-foreground">
            ({completedMethods}/{totalMethods} methodes)
          </span>
        </div>
        {pointsEarned > 0 && (
          <span className="text-primary font-medium">+{pointsEarned} pts</span>
        )}
      </div>

      {/* Next milestone hint */}
      {nextMilestone && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Circle className="h-3 w-3" />
          <span>
            Volgende mijlpaal: {getMilestoneDisplayText(nextMilestone.threshold as MilestoneThreshold)} (+{nextMilestone.points} pts)
          </span>
        </div>
      )}

      {/* All milestones achieved */}
      {progressPercent >= 100 && milestonesAwarded.includes("100") && (
        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
          <CheckCircle2 className="h-4 w-4" />
          <span>Alle mijlpalen behaald!</span>
        </div>
      )}
    </div>
  )
}
