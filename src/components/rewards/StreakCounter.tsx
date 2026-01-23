import { Flame } from "lucide-react"

interface StreakCounterProps {
  currentStreak: number
  longestStreak: number
}

/**
 * Streak display with flame icon
 */
export function StreakCounter({ currentStreak, longestStreak }: StreakCounterProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-full ${currentStreak > 0 ? "bg-orange-100 text-orange-500" : "bg-muted text-muted-foreground"}`}>
          <Flame className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{currentStreak}</p>
          <p className="text-xs text-muted-foreground">Huidige streak</p>
        </div>
      </div>
      <div className="h-10 w-px bg-border" />
      <div>
        <p className="text-lg font-semibold text-muted-foreground">{longestStreak}</p>
        <p className="text-xs text-muted-foreground">Langste</p>
      </div>
    </div>
  )
}
