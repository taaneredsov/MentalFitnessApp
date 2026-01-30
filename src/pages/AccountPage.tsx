import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useCompanies, useUserRewards, usePersonalGoals, useDeletePersonalGoal } from "@/hooks/queries"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChangePasswordForm } from "@/components/ChangePasswordForm"
import { LevelProgress, StreakCounter, BadgeGrid } from "@/components/rewards"
import { PersonalGoalDialog } from "@/components/PersonalGoalDialog"
import { formatPoints } from "@/lib/rewards-utils"
import { LogOut, User, Mail, Building2, KeyRound, Trophy, Star, Target, Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import type { PersonalGoal } from "@/types/program"

const MAX_GOALS = 10

export function AccountPage() {
  const { user, logout, accessToken } = useAuth()
  const navigate = useNavigate()

  // Use React Query for company names (cached)
  const { data: companyMap, isLoading: isLoadingCompanies } = useCompanies(user?.company)

  // Fetch user rewards
  const { data: rewards, isLoading: isLoadingRewards } = useUserRewards()

  // Personal goals
  const { data: personalGoals = [], isLoading: isLoadingGoals } = usePersonalGoals()
  const deleteGoalMutation = useDeletePersonalGoal()

  // Dialog state
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<PersonalGoal | null>(null)
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null)

  const companyNames = useMemo(() => {
    if (!companyMap || !user?.company) return []
    return user.company.map(id => companyMap[id]).filter(Boolean)
  }, [companyMap, user?.company])

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  const handleCreateGoal = () => {
    setEditingGoal(null)
    setGoalDialogOpen(true)
  }

  const handleEditGoal = (goal: PersonalGoal) => {
    setEditingGoal(goal)
    setGoalDialogOpen(true)
  }

  const handleDeleteGoal = async (goalId: string) => {
    if (!accessToken) return

    setDeletingGoalId(goalId)
    try {
      await deleteGoalMutation.mutateAsync({ id: goalId, accessToken })
    } catch (error) {
      console.error("[AccountPage] Failed to delete goal:", error)
    } finally {
      setDeletingGoalId(null)
    }
  }

  if (!user) return null

  return (
    <div className="px-4 py-6 space-y-6">
      <h2 className="text-2xl font-bold">Account</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{user.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Company</p>
              {isLoadingCompanies ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : companyNames.length > 0 ? (
                <p className="font-medium">{companyNames.join(", ")}</p>
              ) : (
                <p className="text-muted-foreground">No company linked</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rewards Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Beloningen
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingRewards ? (
            <p className="text-muted-foreground">Laden...</p>
          ) : rewards ? (
            <div className="space-y-6">
              {/* Level Progress */}
              <div className="flex justify-center">
                <LevelProgress totalPoints={rewards.totalPoints} level={rewards.level} />
              </div>

              {/* Streak Counter */}
              <div className="flex justify-center py-2 border-t border-b">
                <StreakCounter
                  currentStreak={rewards.currentStreak}
                  longestStreak={rewards.longestStreak}
                />
              </div>

              {/* Total Points */}
              <div className="flex items-center justify-center gap-2 text-center">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="text-lg font-semibold">{formatPoints(rewards.totalPoints)} punten</span>
              </div>

              {/* Badges */}
              <div>
                <h4 className="font-medium mb-3">Badges</h4>
                <BadgeGrid earnedBadges={rewards.badges} />
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Geen beloningsgegevens beschikbaar</p>
          )}
        </CardContent>
      </Card>

      {/* Personal Goals Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Mijn Persoonlijke Doelen
            </CardTitle>
            {personalGoals.length < MAX_GOALS && (
              <Button
                size="sm"
                onClick={handleCreateGoal}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nieuw Doel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingGoals ? (
            <p className="text-muted-foreground">Laden...</p>
          ) : personalGoals.length === 0 ? (
            <div className="text-center py-6">
              <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">
                Je hebt nog geen persoonlijke doelen.
              </p>
              <Button onClick={handleCreateGoal}>
                <Plus className="h-4 w-4 mr-2" />
                Maak je eerste doel
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {personalGoals.map(goal => (
                <div
                  key={goal.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{goal.name}</p>
                    {goal.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {goal.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditGoal(goal)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteGoal(goal.id)}
                      disabled={deletingGoalId === goal.id}
                    >
                      {deletingGoalId === goal.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
              {personalGoals.length >= MAX_GOALS && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  Maximum {MAX_GOALS} doelen bereikt
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Wachtwoord wijzigen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Button
        variant="destructive"
        className="w-full"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Log out
      </Button>

      {/* Personal Goal Dialog */}
      <PersonalGoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        goal={editingGoal}
      />
    </div>
  )
}
