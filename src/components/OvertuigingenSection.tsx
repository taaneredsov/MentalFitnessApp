import { useState, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AddOvertuigingDialog } from "@/components/AddOvertuigingDialog"
import { useOvertuigingen, useOvertuigingUsage, usePersoonlijkeOvertuigingen, useCompleteOvertuiging, useUpdatePersoonlijkeOvertuiging, useProgram, useOvertuigingsByGoals, useMindsetCategories } from "@/hooks/queries"
import { useAuth } from "@/contexts/AuthContext"
import { getTodayDate } from "@/lib/rewards-utils"
import { POINTS } from "@/types/rewards"
import type { OvertuigingUsageMap } from "@/types/program"
import { Lightbulb, Plus, Star, Check, ChevronDown } from "lucide-react"

interface OvertuigingenSectionProps {
  programId: string
  showManageLink?: boolean
}

export function OvertuigingenSection({ programId, showManageLink = true }: OvertuigingenSectionProps) {
  const { user, accessToken } = useAuth()
  const { t } = useTranslation()
  const today = useMemo(() => getTodayDate(), [])

  const { data: program } = useProgram(programId)
  const { data: allOvertuigingen = [] } = useOvertuigingen()
  const { data: mindsetCategories = [] } = useMindsetCategories()
  const { data: usageMap = {} as OvertuigingUsageMap, isLoading: isLoadingUsage } = useOvertuigingUsage(programId)
  const { data: persoonlijke = [], isLoading: isLoadingPersoonlijke } = usePersoonlijkeOvertuigingen()

  // Fetch overtuigingen related to program goals for the add dialog
  const goalIds = useMemo(() => program?.goals || [], [program?.goals])
  const { data: goalOvertuigingenFromApi = [] } = useOvertuigingsByGoals(goalIds)

  const goalOvertuigingenLocal = useMemo(() => {
    if (goalIds.length === 0 || allOvertuigingen.length === 0) {
      return []
    }

    const linkedOvertuigingIds = new Set(
      mindsetCategories
        .filter(category => category.goalIds.some(goalId => goalIds.includes(goalId)))
        .flatMap(category => category.overtuigingIds)
    )

    return allOvertuigingen
      .filter(overtuiging => {
        const directGoalIds = Array.isArray(overtuiging.goalIds) ? overtuiging.goalIds : []
        const matchesDirectGoal = directGoalIds.some(goalId => goalIds.includes(goalId))
        const matchesCategoryGoal = linkedOvertuigingIds.has(overtuiging.id)
        return matchesDirectGoal || matchesCategoryGoal
      })
      .sort((a, b) => a.order - b.order)
  }, [goalIds, mindsetCategories, allOvertuigingen])

  // Use union of API + local filtering to avoid partial results in mixed backend modes.
  const goalOvertuigingen = useMemo(() => {
    const merged = new Map<string, typeof allOvertuigingen[number]>()
    goalOvertuigingenLocal.forEach(o => merged.set(o.id, o))
    goalOvertuigingenFromApi.forEach(o => merged.set(o.id, o))
    return Array.from(merged.values()).sort((a, b) => a.order - b.order)
  }, [goalOvertuigingenLocal, goalOvertuigingenFromApi])

  const completeOvertuigingMutation = useCompleteOvertuiging()
  const updatePersoonlijkeMutation = useUpdatePersoonlijkeOvertuiging()

  const [recentlyCompleted, setRecentlyCompleted] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  // System overtuigingen available to add (related to goals, not yet in program)
  const availableToAdd = useMemo(() => {
    const currentIds = new Set(program?.overtuigingen || [])
    return goalOvertuigingen.filter(o => !currentIds.has(o.id))
  }, [goalOvertuigingen, program?.overtuigingen])

  const isLoading = isLoadingUsage || isLoadingPersoonlijke

  // Program's overtuigingen (system)
  const programOvertuigingen = useMemo(() => {
    const ids = program?.overtuigingen || []
    return allOvertuigingen.filter(o => ids.includes(o.id)).sort((a, b) => a.order - b.order)
  }, [program?.overtuigingen, allOvertuigingen])

  // Active personal overtuigingen
  const activePersoonlijke = useMemo(() => {
    return persoonlijke.filter(p => p.status === "Actief")
  }, [persoonlijke])

  const isCompleted = useCallback((overtuigingId: string): boolean => {
    return usageMap[overtuigingId]?.completed === true
  }, [usageMap])

  // Split into active and completed
  const activeOvertuigingen = useMemo(() => {
    return programOvertuigingen.filter(o => !isCompleted(o.id)).sort((a, b) => a.order - b.order)
  }, [programOvertuigingen, isCompleted])

  const completedOvertuigingen = useMemo(() => {
    return programOvertuigingen.filter(o => isCompleted(o.id)).sort((a, b) => a.order - b.order)
  }, [programOvertuigingen, isCompleted])

  const handleComplete = async (overtuigingId: string) => {
    if (!user?.id || !accessToken) return
    if (isCompleted(overtuigingId)) return

    setRecentlyCompleted(overtuigingId)
    setTimeout(() => setRecentlyCompleted(null), 2000)

    completeOvertuigingMutation.mutate({
      data: {
        userId: user.id,
        overtuigingId,
        programId,
        date: today
      },
      accessToken
    }, {
      onError: () => {
        setRecentlyCompleted(null)
      }
    })
  }

  const handleCompletePersoonlijke = async (id: string) => {
    if (!accessToken) return

    setRecentlyCompleted(id)
    setTimeout(() => setRecentlyCompleted(null), 2000)

    updatePersoonlijkeMutation.mutate({
      id,
      data: { status: "Afgerond" },
      accessToken
    }, {
      onError: () => {
        setRecentlyCompleted(null)
      }
    })
  }

  const hasItems = programOvertuigingen.length > 0 || activePersoonlijke.length > 0

  if (!isLoading && !hasItems) {
    return (
      <>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-[#00978A]" />
                <CardTitle className="text-lg">Overtuigingen</CardTitle>
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
              Geen overtuigingen. Voeg je eerste toe!
            </p>
          </CardContent>
        </Card>
        <AddOvertuigingDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          programId={programId}
          currentOvertuigingen={program?.overtuigingen || []}
          availableOvertuigingen={availableToAdd}
        />
      </>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-[#00978A]" />
            <CardTitle className="text-lg">Overtuigingen</CardTitle>
          </div>
          {showManageLink && hasItems && (
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
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground">Laden...</p>
        ) : (
          <>
            {/* Active system overtuigingen */}
            {activeOvertuigingen.map(overtuiging => (
              <div
                key={overtuiging.id}
                className="w-full p-4 rounded-2xl transition-all duration-200 bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#00978A]/15 flex items-center justify-center">
                    <Lightbulb className="h-6 w-6 text-[#00978A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base break-words whitespace-normal">{overtuiging.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Programmeer de overtuiging met de balansmethode, en zet een vinkje wanneer afgerond.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {recentlyCompleted === overtuiging.id && (
                      <span className="flex items-center gap-0.5 text-xs font-medium text-primary animate-in fade-in zoom-in duration-300">
                        <Star className="h-3 w-3" />
                        +{POINTS.overtuiging}
                      </span>
                    )}
                    <button
                      onClick={() => handleComplete(overtuiging.id)}
                      disabled={completeOvertuigingMutation.isPending}
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-50 bg-gray-200 text-gray-400 hover:bg-gray-300"
                      aria-label="Overtuiging voltooien"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* All completed message */}
            {activeOvertuigingen.length === 0 && activePersoonlijke.length === 0 && completedOvertuigingen.length > 0 && (
              <p className="text-muted-foreground text-center text-sm py-2">
                {t("overtuigingen.allCompleted")}
              </p>
            )}

            {/* Completed overtuigingen — collapsible */}
            {completedOvertuigingen.length > 0 && (
              <>
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showCompleted ? "rotate-180" : ""}`} />
                  Voltooid ({completedOvertuigingen.length})
                </button>
                {showCompleted && completedOvertuigingen.map(overtuiging => (
                  <div
                    key={overtuiging.id}
                    className="w-full p-4 rounded-2xl bg-muted/30 opacity-70"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#00978A]/15 flex items-center justify-center">
                        <Lightbulb className="h-6 w-6 text-[#00978A]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-base break-words whitespace-normal">{overtuiging.name}</p>
                        <span className="text-xs text-[#007D72] font-medium">Voltooid</span>
                      </div>
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-[#00978A] text-white">
                        <Check className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Personal overtuigingen */}
            {activePersoonlijke.map(item => (
              <div
                key={item.id}
                className="w-full p-4 rounded-2xl transition-all duration-200 bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#00978A]/15 flex items-center justify-center">
                    <Lightbulb className="h-6 w-6 text-[#00978A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base break-words whitespace-normal">{item.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Persoonlijk</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {recentlyCompleted === item.id && (
                      <span className="flex items-center gap-0.5 text-xs font-medium text-primary animate-in fade-in zoom-in duration-300">
                        <Star className="h-3 w-3" />
                        +{POINTS.overtuiging}
                      </span>
                    )}
                    <button
                      onClick={() => handleCompletePersoonlijke(item.id)}
                      disabled={updatePersoonlijkeMutation.isPending}
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-50 bg-gray-200 text-gray-400 hover:bg-gray-300"
                      aria-label="Overtuiging afvinken"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
      <AddOvertuigingDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        programId={programId}
        currentOvertuigingen={program?.overtuigingen || []}
        availableOvertuigingen={availableToAdd}
      />
    </Card>
  )
}
