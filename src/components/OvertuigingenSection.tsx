import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AddOvertuigingDialog } from "@/components/AddOvertuigingDialog"
import { useOvertuigingen, useOvertuigingUsage, usePersoonlijkeOvertuigingen, useCompleteOvertuiging, useUpdatePersoonlijkeOvertuiging, useProgram, useOvertuigingsByGoals } from "@/hooks/queries"
import { useAuth } from "@/contexts/AuthContext"
import { getTodayDate } from "@/lib/rewards-utils"
import { POINTS } from "@/types/rewards"
import type { OvertuigingUsageMap } from "@/types/program"
import { Lightbulb, Plus, Star, Check } from "lucide-react"

interface OvertuigingenSectionProps {
  programId: string
  showManageLink?: boolean
}

const LEVEL_LABELS = ["Niveau 1", "Niveau 2", "Niveau 3"]

export function OvertuigingenSection({ programId, showManageLink = true }: OvertuigingenSectionProps) {
  const { user, accessToken } = useAuth()
  const today = useMemo(() => getTodayDate(), [])

  const { data: program } = useProgram(programId)
  const { data: allOvertuigingen = [] } = useOvertuigingen()
  const { data: usageMap = {} as OvertuigingUsageMap, isLoading: isLoadingUsage } = useOvertuigingUsage(programId)
  const { data: persoonlijke = [], isLoading: isLoadingPersoonlijke } = usePersoonlijkeOvertuigingen()

  // Fetch overtuigingen related to program goals for the add dialog
  const goalIds = program?.goals || []
  const { data: goalOvertuigingen = [] } = useOvertuigingsByGoals(goalIds)

  const completeOvertuigingMutation = useCompleteOvertuiging()
  const updatePersoonlijkeMutation = useUpdatePersoonlijkeOvertuiging()

  const [recentlyCompleted, setRecentlyCompleted] = useState<string | null>(null)
  const [recentlyFinished, setRecentlyFinished] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)

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

  const getCompletedLevelCount = (overtuigingId: string): number => {
    return usageMap[overtuigingId]?.currentLevel || 0
  }

  const handleCompleteLevel = async (overtuigingId: string) => {
    if (!user?.id || !accessToken) return

    const completedLevels = getCompletedLevelCount(overtuigingId)
    if (completedLevels >= LEVEL_LABELS.length) return

    const nextLevel = LEVEL_LABELS[completedLevels]
    const isFinishing = completedLevels === LEVEL_LABELS.length - 1

    setRecentlyCompleted(overtuigingId)
    setRecentlyFinished(isFinishing)
    setTimeout(() => { setRecentlyCompleted(null); setRecentlyFinished(false) }, 2000)

    completeOvertuigingMutation.mutate({
      data: {
        userId: user.id,
        overtuigingId,
        programId,
        level: nextLevel,
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
            {/* System overtuigingen with 3-level progress */}
            {programOvertuigingen.map(overtuiging => {
              const completedLevels = getCompletedLevelCount(overtuiging.id)
              const isFullyComplete = completedLevels >= LEVEL_LABELS.length
              return (
                <div
                  key={overtuiging.id}
                  className="w-full p-4 rounded-2xl transition-all duration-200 bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#00978A]/15 flex items-center justify-center">
                      <Lightbulb className="h-6 w-6 text-[#00978A]" />
                    </div>

                    {/* Name and level dots */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base">{overtuiging.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {LEVEL_LABELS.map((level, i) => (
                          <div
                            key={level}
                            className={`w-3 h-3 rounded-full border-2 ${
                              i < completedLevels
                                ? "bg-[#00978A] border-[#00978A]"
                                : i === completedLevels
                                  ? "bg-transparent border-[#00978A]"
                                  : "bg-transparent border-gray-300"
                            }`}
                            title={level}
                          />
                        ))}
                        {isFullyComplete && (
                          <span className="text-xs text-[#007D72] font-medium ml-1">Voltooid</span>
                        )}
                      </div>
                    </div>

                    {/* Points animation + action button */}
                    <div className="flex items-center gap-2">
                      {recentlyCompleted === overtuiging.id && recentlyFinished && (
                        <span className="flex items-center gap-0.5 text-xs font-medium text-primary animate-in fade-in zoom-in duration-300">
                          <Star className="h-3 w-3" />
                          +{POINTS.overtuiging}
                        </span>
                      )}
                      {!isFullyComplete && (
                        <button
                          onClick={() => handleCompleteLevel(overtuiging.id)}
                          disabled={completeOvertuigingMutation.isPending}
                          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-50 bg-[#00978A] text-white shadow-sm hover:bg-[#007D72]"
                          aria-label="Niveau voltooien"
                        >
                          <Check className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

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
                    <p className="font-semibold text-base">{item.name}</p>
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
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-50 bg-[#00978A] text-white shadow-sm hover:bg-[#007D72]"
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
