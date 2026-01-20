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

  // Extract emoji from habit name (if present at the start)
  // Handles ZWJ sequences like 🙆‍♂️ (person + ZWJ + male sign)
  const getEmojiAndName = (name: string) => {
    // Match emoji including ZWJ sequences (emoji + optional variation selector, joined by ZWJ)
    const emojiMatch = name.match(/^((?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F?))*)\s*/u)
    if (emojiMatch) {
      return {
        emoji: emojiMatch[1],
        name: name.slice(emojiMatch[0].length)
      }
    }
    return { emoji: null, name }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Goede Gewoontes</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground">Laden...</p>
        ) : (
          habits.map(habit => {
            const isCompleted = completedHabits.has(habit.id)
            const { emoji, name } = getEmojiAndName(habit.name)
            return (
              <button
                key={habit.id}
                onClick={() => toggleHabit(habit.id)}
                className="w-full p-4 rounded-2xl text-left transition-all duration-200 flex items-center gap-4 bg-card border-0 shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                {/* Emoji icon in circle */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-muted/70 flex items-center justify-center text-2xl">
                  {emoji || "✨"}
                </div>

                {/* Habit name */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base">
                    {name}
                  </p>
                  {habit.description && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                      {habit.description}
                    </p>
                  )}
                </div>

                {/* Checkmark button */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    isCompleted
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground/50"
                  }`}
                >
                  <Check className={`h-5 w-5 ${isCompleted ? "" : "opacity-40"}`} />
                </div>
              </button>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
