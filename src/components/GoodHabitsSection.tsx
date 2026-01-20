import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useGoodHabits } from "@/hooks/queries"
import { Heart, Check } from "lucide-react"

function getTodayKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `goodHabits_${year}-${month}-${day}`
}

function getCompletedHabits(): Set<string> {
  const key = getTodayKey()
  const stored = localStorage.getItem(key)
  if (!stored) return new Set()
  try {
    return new Set(JSON.parse(stored))
  } catch {
    return new Set()
  }
}

function saveCompletedHabits(habitIds: Set<string>) {
  const key = getTodayKey()
  localStorage.setItem(key, JSON.stringify([...habitIds]))
}

export function GoodHabitsSection() {
  const { data: habits = [], isLoading } = useGoodHabits()
  const [completedHabits, setCompletedHabits] = useState<Set<string>>(() => getCompletedHabits())

  useEffect(() => {
    // Refresh completed habits when component mounts (in case date changed)
    setCompletedHabits(getCompletedHabits())
  }, [])

  const toggleHabit = (habitId: string) => {
    setCompletedHabits(prev => {
      const next = new Set(prev)
      if (next.has(habitId)) {
        next.delete(habitId)
      } else {
        next.add(habitId)
      }
      saveCompletedHabits(next)
      return next
    })
  }

  // Don't render if no habits
  if (!isLoading && habits.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Goede Gewoontes</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden...</p>
        ) : (
          habits.map(habit => {
            const isCompleted = completedHabits.has(habit.id)
            return (
              <button
                key={habit.id}
                onClick={() => toggleHabit(habit.id)}
                className={`w-full p-3 rounded-lg text-left transition-colors flex items-start gap-3 ${
                  isCompleted
                    ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                    : "bg-muted/50 hover:bg-muted"
                }`}
              >
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors ${
                    isCompleted
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {isCompleted && <Check className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isCompleted ? "text-green-700 dark:text-green-300" : ""}`}>
                    {habit.name}
                  </p>
                  {habit.description && (
                    <p className={`text-xs mt-0.5 ${
                      isCompleted ? "text-green-600/70 dark:text-green-400/70" : "text-muted-foreground"
                    }`}>
                      {habit.description}
                    </p>
                  )}
                </div>
              </button>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
