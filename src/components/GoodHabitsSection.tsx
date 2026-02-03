import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useGoodHabits, useHabitUsage, useRecordHabitUsage, useDeleteHabitUsage } from "@/hooks/queries"
import { useAuth } from "@/contexts/AuthContext"
import { getTodayDate } from "@/lib/rewards-utils"
import { POINTS } from "@/types/rewards"
import { Heart, Check, Star } from "lucide-react"

export function GoodHabitsSection() {
  const { user, accessToken } = useAuth()
  const today = useMemo(() => getTodayDate(), [])

  const { data: habits = [], isLoading: isLoadingHabits } = useGoodHabits()
  const { data: completedHabitIds = [], isLoading: isLoadingUsage } = useHabitUsage(user?.id, today)

  const recordHabitMutation = useRecordHabitUsage()
  const deleteHabitMutation = useDeleteHabitUsage()

  const [expandedHabit, setExpandedHabit] = useState<string | null>(null)
  const [recentlyCompleted, setRecentlyCompleted] = useState<string | null>(null)

  // React Query now handles optimistic updates via onMutate
  const completedHabits = useMemo(() => new Set(completedHabitIds), [completedHabitIds])

  const isLoading = isLoadingHabits || isLoadingUsage

  const toggleHabit = async (habitId: string) => {
    if (!user?.id || !accessToken) return

    const isCompleted = completedHabits.has(habitId)

    if (isCompleted) {
      // Uncomplete the habit - React Query handles optimistic update
      deleteHabitMutation.mutate({
        userId: user.id,
        methodId: habitId,
        date: today,
        accessToken
      }, {
        onError: (error) => {
          console.error("[GoodHabitsSection] Failed to delete habit:", error)
        }
      })
    } else {
      // Show points animation
      setRecentlyCompleted(habitId)
      setTimeout(() => setRecentlyCompleted(null), 2000)

      // Complete the habit - React Query handles optimistic update
      recordHabitMutation.mutate({
        data: {
          userId: user.id,
          methodId: habitId,
          date: today
        },
        accessToken
      }, {
        onError: (error) => {
          console.error("[GoodHabitsSection] Failed to record habit:", error)
          // Clear the animation on error
          setRecentlyCompleted(null)
        }
      })
    }
  }

  const toggleExpanded = (habitId: string) => {
    setExpandedHabit(prev => prev === habitId ? null : habitId)
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
            const isExpanded = expandedHabit === habit.id
            const { emoji, name } = getEmojiAndName(habit.name)
            return (
              <div
                key={habit.id}
                onClick={() => toggleExpanded(habit.id)}
                className="w-full p-4 rounded-2xl text-left transition-all duration-200 bg-muted/50 hover:bg-muted/70 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Emoji icon in circle */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-muted/70 flex items-center justify-center text-2xl">
                    {emoji || "✨"}
                  </div>

                  {/* Habit name */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base">
                      {name}
                    </p>
                    {habit.description && !isExpanded && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                        {habit.description}
                      </p>
                    )}
                  </div>

                  {/* Points indicator + Checkmark button */}
                  <div className="flex items-center gap-2">
                    {recentlyCompleted === habit.id && (
                      <span className="flex items-center gap-0.5 text-xs font-medium text-primary animate-in fade-in zoom-in duration-300">
                        <Star className="h-3 w-3" />
                        +{POINTS.habit}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleHabit(habit.id)
                      }}
                      disabled={recordHabitMutation.isPending || deleteHabitMutation.isPending}
                      className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                        isCompleted
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/50 text-muted-foreground/50"
                      }`}
                    >
                      <Check className={`h-5 w-5 ${isCompleted ? "" : "opacity-40"}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded description */}
                {isExpanded && habit.description && (
                  <div className="mt-3 pl-16 pr-14">
                    <p className="text-sm text-muted-foreground">
                      {habit.description}
                    </p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
