import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useCompanies, useUserRewards, usePersonalGoals, useDeletePersonalGoal, useNotificationPreferences, useUpdateNotificationPreferences } from "@/hooks/queries"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChangePasswordForm } from "@/components/ChangePasswordForm"
import { LevelProgress, StreakCounter, BadgeGrid } from "@/components/rewards"
import { PersonalGoalDialog } from "@/components/PersonalGoalDialog"
import { formatPoints } from "@/lib/rewards-utils"
import { getCurrentPushSubscription, getNotificationPermission, isPushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push"
import { api } from "@/lib/api-client"
import type { ReminderMode } from "@/types/notifications"
import { LogOut, User, Mail, Building2, KeyRound, Trophy, Star, Target, Plus, Pencil, Trash2, Loader2, Bell } from "lucide-react"
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
  const { data: notificationPreferences, isLoading: isLoadingNotificationPreferences } = useNotificationPreferences()
  const updateNotificationPreferences = useUpdateNotificationPreferences()

  // Dialog state
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<PersonalGoal | null>(null)
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null)
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null)
  const [notificationError, setNotificationError] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(getNotificationPermission())
  const [isTogglingPush, setIsTogglingPush] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [prefsForm, setPrefsForm] = useState<{
    enabled: boolean
    reminderMode: ReminderMode
    leadMinutes: number
    preferredTimeLocal: string
    timezone: string
    quietHoursStart: string
    quietHoursEnd: string
  }>({
    enabled: true,
    reminderMode: "both",
    leadMinutes: 60,
    preferredTimeLocal: "19:00",
    timezone: "Europe/Brussels",
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00"
  })

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

  useEffect(() => {
    setPermission(getNotificationPermission())
  }, [])

  useEffect(() => {
    if (!notificationPreferences) return
    setPrefsForm({
      enabled: notificationPreferences.enabled,
      reminderMode: notificationPreferences.reminderMode,
      leadMinutes: notificationPreferences.leadMinutes,
      preferredTimeLocal: notificationPreferences.preferredTimeLocal,
      timezone: notificationPreferences.timezone,
      quietHoursStart: notificationPreferences.quietHoursStart,
      quietHoursEnd: notificationPreferences.quietHoursEnd
    })
  }, [notificationPreferences])

  const saveNotificationPreferences = async () => {
    if (!accessToken) return
    setNotificationMessage(null)
    setNotificationError(null)

    try {
      await updateNotificationPreferences.mutateAsync({
        accessToken,
        data: {
          enabled: prefsForm.enabled,
          reminderMode: prefsForm.reminderMode,
          leadMinutes: prefsForm.leadMinutes,
          preferredTimeLocal: prefsForm.preferredTimeLocal,
          timezone: prefsForm.timezone,
          quietHoursStart: prefsForm.quietHoursStart,
          quietHoursEnd: prefsForm.quietHoursEnd
        }
      })
      setNotificationMessage("Notificatie-instellingen opgeslagen.")
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : "Opslaan mislukt")
    }
  }

  const handleEnablePush = async () => {
    if (!accessToken) return
    if (!notificationPreferences?.vapidPublicKey) {
      setNotificationError("Push is niet geconfigureerd op de server.")
      return
    }

    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || prefsForm.timezone

    setIsTogglingPush(true)
    setNotificationMessage(null)
    setNotificationError(null)

    try {
      const subscription = await subscribeToPush(notificationPreferences.vapidPublicKey)
      await api.notifications.subscribe(subscription, accessToken, browserTz)
      await updateNotificationPreferences.mutateAsync({
        accessToken,
        data: {
          enabled: true,
          timezone: browserTz
        }
      })
      setPrefsForm((prev) => ({
        ...prev,
        enabled: true,
        timezone: browserTz
      }))
      setPermission(getNotificationPermission())
      setNotificationMessage("Push notificaties zijn geactiveerd.")
    } catch (error) {
      setPermission(getNotificationPermission())
      setNotificationError(error instanceof Error ? error.message : "Push activeren mislukt")
    } finally {
      setIsTogglingPush(false)
    }
  }

  const handleDisablePush = async () => {
    if (!accessToken) return
    setIsTogglingPush(true)
    setNotificationMessage(null)
    setNotificationError(null)

    try {
      const current = await getCurrentPushSubscription()
      const unsubscribed = await unsubscribeFromPush()
      const endpoint = unsubscribed?.endpoint || current?.endpoint
      if (endpoint) {
        await api.notifications.unsubscribe(endpoint, accessToken)
      }
      await updateNotificationPreferences.mutateAsync({
        accessToken,
        data: { enabled: false }
      })
      setPrefsForm((prev) => ({ ...prev, enabled: false }))
      setPermission(getNotificationPermission())
      setNotificationMessage("Push notificaties zijn uitgeschakeld.")
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : "Push uitschakelen mislukt")
    } finally {
      setIsTogglingPush(false)
    }
  }

  const handleSendTestNotification = async () => {
    if (!accessToken) return
    setIsSendingTest(true)
    setNotificationMessage(null)
    setNotificationError(null)

    try {
      const result = await api.notifications.sendTest(accessToken)
      setNotificationMessage(`Test verstuurd: ${result.sent} succesvol, ${result.failed} mislukt.`)
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : "Test notificatie mislukt")
    } finally {
      setIsSendingTest(false)
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaties
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <p className="text-muted-foreground">Push ondersteuning</p>
            <p className="font-medium">
              {isPushSupported() ? "Ondersteund" : "Niet ondersteund"}
            </p>
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">Browser toestemming</p>
            <p className="font-medium">{permission}</p>
          </div>
          {isLoadingNotificationPreferences ? (
            <p className="text-muted-foreground text-sm">Notificatie-instellingen laden...</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications-enabled">Herinneringen actief</Label>
                <input
                  id="notifications-enabled"
                  type="checkbox"
                  checked={prefsForm.enabled}
                  onChange={(e) => setPrefsForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reminder-mode">Herinneringsmodus</Label>
                <select
                  id="reminder-mode"
                  className="w-full border rounded-md px-3 py-2 bg-background"
                  value={prefsForm.reminderMode}
                  onChange={(e) =>
                    setPrefsForm((prev) => ({
                      ...prev,
                      reminderMode: e.target.value as ReminderMode
                    }))
                  }
                >
                  <option value="session">Per sessie</option>
                  <option value="daily_summary">Dagelijkse samenvatting</option>
                  <option value="both">Beide</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-minutes">Vooraankondiging (minuten)</Label>
                <Input
                  id="lead-minutes"
                  type="number"
                  min={0}
                  max={1440}
                  value={prefsForm.leadMinutes}
                  onChange={(e) => {
                    const value = Number(e.target.value)
                    setPrefsForm((prev) => ({ ...prev, leadMinutes: Number.isFinite(value) ? value : prev.leadMinutes }))
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferred-time">Voorkeurstijd</Label>
                <Input
                  id="preferred-time"
                  type="time"
                  value={prefsForm.preferredTimeLocal}
                  onChange={(e) => setPrefsForm((prev) => ({ ...prev, preferredTimeLocal: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Tijdzone</Label>
                <Input
                  id="timezone"
                  value={prefsForm.timezone}
                  onChange={(e) => setPrefsForm((prev) => ({ ...prev, timezone: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="quiet-start">Stilte start</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={prefsForm.quietHoursStart}
                    onChange={(e) => setPrefsForm((prev) => ({ ...prev, quietHoursStart: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiet-end">Stilte einde</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={prefsForm.quietHoursEnd}
                    onChange={(e) => setPrefsForm((prev) => ({ ...prev, quietHoursEnd: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={saveNotificationPreferences}
                  disabled={updateNotificationPreferences.isPending}
                >
                  Instellingen opslaan
                </Button>
                <Button
                  onClick={handleEnablePush}
                  disabled={isTogglingPush || !notificationPreferences?.webPushConfigured}
                >
                  Push activeren
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDisablePush}
                  disabled={isTogglingPush}
                >
                  Push uitschakelen
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSendTestNotification}
                  disabled={isSendingTest || !notificationPreferences?.webPushConfigured}
                >
                  Test notificatie
                </Button>
              </div>

              {!notificationPreferences?.webPushConfigured && (
                <p className="text-sm text-amber-700">
                  Push serverconfiguratie ontbreekt (VAPID keys).
                </p>
              )}
              {notificationMessage && (
                <p className="text-sm text-green-700">{notificationMessage}</p>
              )}
              {notificationError && (
                <p className="text-sm text-destructive">{notificationError}</p>
              )}
            </>
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
