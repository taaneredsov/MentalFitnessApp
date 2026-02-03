import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PersonalGoalDialog } from "@/components/PersonalGoalDialog"
import { usePersonalGoals, usePersonalGoalUsage, useCompletePersonalGoal } from "@/hooks/queries"
import { useAuth } from "@/contexts/AuthContext"
import { getTodayDate } from "@/lib/rewards-utils"
import { POINTS } from "@/types/rewards"
import { Target, Plus, Star, Settings, Check } from "lucide-react"

interface PersonalGoalsSectionProps {
  showManageLink?: boolean
}

export function PersonalGoalsSection({ showManageLink = true }: PersonalGoalsSectionProps) {
  const { user, accessToken } = useAuth()
  const navigate = useNavigate()
  const today = useMemo(() => getTodayDate(), [])

  const { data: goals = [], isLoading: isLoadingGoals } = usePersonalGoals()
  const { data: goalCounts = {}, isLoading: isLoadingUsage } = usePersonalGoalUsage(user?.id, today)

  const completeGoalMutation = useCompletePersonalGoal()

  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)
  const [recentlyCompleted, setRecentlyCompleted] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const isLoading = isLoadingGoals || isLoadingUsage

  const completeGoal = async (goalId: string) => {
    if (!user?.id || !accessToken) return

    // Show points animation
    setRecentlyCompleted(goalId)
    setTimeout(() => setRecentlyCompleted(null), 2000)

    // Complete the goal
    completeGoalMutation.mutate({
      data: {
        userId: user.id,
        personalGoalId: goalId,
        date: today
      },
      accessToken
    }, {
      onError: () => {
        setRecentlyCompleted(null)
      }
    })
  }

  const toggleExpanded = (goalId: string) => {
    setExpandedGoal(prev => prev === goalId ? null : goalId)
  }

  // Don't render the section at all if no goals and not loading
  if (!isLoading && goals.length === 0) {
    return (
      <>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Persoonlijke Doelen</CardTitle>
              </div>
              {showManageLink && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Toevoegen
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-4">
              Geen persoonlijke doelen. Voeg je eerste toe!
            </p>
          </CardContent>
        </Card>
        <PersonalGoalDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
        />
      </>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Persoonlijke Doelen</CardTitle>
          </div>
          {showManageLink && goals.length > 0 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Toevoegen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => navigate("/account")}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground">Laden...</p>
        ) : (
          goals.map(goal => {
            const counts = goalCounts[goal.id] || { today: 0, total: 0 }
            const isExpanded = expandedGoal === goal.id
            return (
              <div
                key={goal.id}
                onClick={() => toggleExpanded(goal.id)}
                className="w-full p-4 rounded-2xl text-left transition-all duration-200 bg-muted/50 hover:bg-muted/70 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Goal icon with total count */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center relative">
                    <Target className="h-6 w-6 text-primary" />
                    {counts.total > 0 && (
                      <div className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                        {counts.total}
                      </div>
                    )}
                  </div>

                  {/* Goal name and today's count */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base">
                      {goal.name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {counts.today > 0 ? (
                        <span className="text-primary font-medium">
                          {counts.today}x vandaag
                        </span>
                      ) : (
                        "Nog niet gedaan vandaag"
                      )}
                      {counts.total > 0 && (
                        <span className="text-muted-foreground"> · {counts.total} totaal</span>
                      )}
                    </p>
                  </div>

                  {/* Points indicator + Add button */}
                  <div className="flex items-center gap-2">
                    {recentlyCompleted === goal.id && (
                      <span className="flex items-center gap-0.5 text-xs font-medium text-primary animate-in fade-in zoom-in duration-300">
                        <Star className="h-3 w-3" />
                        +{POINTS.personalGoal}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        completeGoal(goal.id)
                      }}
                      disabled={completeGoalMutation.isPending}
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-50 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                      aria-label="Doel afvinken"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Expanded description */}
                {isExpanded && goal.description && (
                  <div className="mt-3 pl-16 pr-14">
                    <p className="text-sm text-muted-foreground">
                      {goal.description}
                    </p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
      <PersonalGoalDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />
    </Card>
  )
}
