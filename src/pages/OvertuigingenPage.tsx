import { useState, useMemo } from "react"
import { useOvertuigingen, useGoals, useMindsetCategories, useAllOvertuigingUsage, useCompleteOvertuiging } from "@/hooks/queries"
import { useAuth } from "@/contexts/AuthContext"
import { getTodayDate } from "@/lib/rewards-utils"
import { POINTS } from "@/types/rewards"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Overtuiging, OvertuigingUsageMap } from "@/types/program"
import { Loader2, Search, X, Lightbulb, Check, Star, ChevronDown } from "lucide-react"

function OvertuigingCard({
  overtuiging,
  categoryName,
  completed,
  onComplete,
  isPending,
  recentlyCompleted
}: {
  overtuiging: Overtuiging
  categoryName?: string
  completed: boolean
  onComplete: () => void
  isPending: boolean
  recentlyCompleted: boolean
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 p-3">
        {/* Icon */}
        <div className="w-12 h-12 rounded-lg bg-[#00978A]/15 shrink-0 flex items-center justify-center">
          <Lightbulb className="h-6 w-6 text-[#00978A]" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h3 className="font-medium text-sm line-clamp-1">{overtuiging.name}</h3>
          {categoryName && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {categoryName}
            </p>
          )}
          {completed ? (
            <span className="text-xs text-[#007D72] font-medium mt-0.5">Voltooid</span>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Print in met de balansmethode. Indien je inprint met de balansmethode, zet een vinkje.
            </p>
          )}
        </div>

        {/* Check button + points */}
        <div className="flex items-center gap-2 shrink-0">
          {recentlyCompleted && (
            <span className="flex items-center gap-0.5 text-xs font-medium text-primary animate-in fade-in zoom-in duration-300">
              <Star className="h-3 w-3" />
              +{POINTS.overtuiging}
            </span>
          )}
          <button
            onClick={onComplete}
            disabled={completed || isPending}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-100 ${
              completed
                ? "bg-[#00978A] text-white"
                : "bg-gray-200 text-gray-400 hover:bg-gray-300"
            }`}
            aria-label={completed ? "Voltooid" : "Overtuiging voltooien"}
          >
            <Check className="h-5 w-5" />
          </button>
        </div>
      </div>
    </Card>
  )
}

export function OvertuigingenPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [recentlyCompletedId, setRecentlyCompletedId] = useState<string | null>(null)

  const { user, accessToken } = useAuth()
  const today = useMemo(() => getTodayDate(), [])

  const { data: overtuigingen = [], isLoading: overtuigingenLoading, error: overtuigingenError } = useOvertuigingen()
  const { data: goals = [], isLoading: goalsLoading } = useGoals()
  const { data: categories = [], isLoading: categoriesLoading } = useMindsetCategories()
  const { data: usageMap = {} as OvertuigingUsageMap } = useAllOvertuigingUsage()

  const completeOvertuigingMutation = useCompleteOvertuiging()

  const isLoading = overtuigingenLoading || goalsLoading || categoriesLoading
  const error = overtuigingenError ? "Kon overtuigingen niet laden" : null

  const isCompleted = (overtuigingId: string): boolean => {
    return usageMap[overtuigingId]?.completed === true
  }

  const handleComplete = (overtuigingId: string) => {
    if (!user?.id || !accessToken) return
    if (isCompleted(overtuigingId)) return

    setRecentlyCompletedId(overtuigingId)
    setTimeout(() => setRecentlyCompletedId(null), 2000)

    completeOvertuigingMutation.mutate({
      data: {
        userId: user.id,
        overtuigingId,
        date: today
      },
      accessToken
    }, {
      onError: () => {
        setRecentlyCompletedId(null)
      }
    })
  }

  // Build category name lookup
  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach(cat => {
      cat.overtuigingIds.forEach(oId => {
        map.set(oId, cat.name)
      })
    })
    return map
  }, [categories])

  // Build overtuigingId -> goalIds mapping via categories
  const overtuigingGoalMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    categories.forEach(cat => {
      cat.overtuigingIds.forEach(oId => {
        if (!map.has(oId)) map.set(oId, new Set())
        cat.goalIds.forEach(gId => map.get(oId)!.add(gId))
      })
    })
    return map
  }, [categories])

  // Goals available for filter chips (those linked to at least one category)
  const availableGoals = useMemo(() => {
    const linkedGoalIds = new Set<string>()
    categories.forEach(cat => {
      cat.goalIds.forEach(gId => linkedGoalIds.add(gId))
    })
    return goals.filter(g => linkedGoalIds.has(g.id))
  }, [goals, categories])

  // Filter + search
  const filteredOvertuigingen = useMemo(() => {
    let result = [...overtuigingen].sort((a, b) => a.order - b.order)

    // Goal filter
    if (selectedGoalId) {
      result = result.filter(o => {
        const goalIds = overtuigingGoalMap.get(o.id)
        return goalIds?.has(selectedGoalId)
      })
    }

    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(o => {
        if (o.name.toLowerCase().includes(query)) return true
        const catName = categoryNameMap.get(o.id)
        if (catName?.toLowerCase().includes(query)) return true
        return false
      })
    }

    return result
  }, [overtuigingen, selectedGoalId, searchQuery, overtuigingGoalMap, categoryNameMap])

  // Split into active and completed
  const activeOvertuigingen = useMemo(() => {
    return filteredOvertuigingen.filter(o => !isCompleted(o.id))
  }, [filteredOvertuigingen, usageMap])

  const completedOvertuigingen = useMemo(() => {
    return filteredOvertuigingen.filter(o => isCompleted(o.id))
  }, [filteredOvertuigingen, usageMap])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <h2 className="text-2xl font-bold">Overtuigingen</h2>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Zoek overtuigingen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Zoekopdracht wissen"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Goal Filter Chips */}
      {availableGoals.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          <button
            onClick={() => setSelectedGoalId(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !selectedGoalId
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Alle
          </button>
          {availableGoals.map(goal => (
            <button
              key={goal.id}
              onClick={() => setSelectedGoalId(
                selectedGoalId === goal.id ? null : goal.id
              )}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedGoalId === goal.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {goal.name}
            </button>
          ))}
        </div>
      )}

      {filteredOvertuigingen.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery.trim() && selectedGoalId
              ? "Geen overtuigingen gevonden voor deze combinatie."
              : searchQuery.trim()
                ? "Geen overtuigingen gevonden voor deze zoekopdracht."
                : selectedGoalId
                  ? "Geen overtuigingen gevonden voor deze doelstelling."
                  : "Geen overtuigingen beschikbaar."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active beliefs */}
          {activeOvertuigingen.map(overtuiging => (
            <OvertuigingCard
              key={overtuiging.id}
              overtuiging={overtuiging}
              categoryName={categoryNameMap.get(overtuiging.id)}
              completed={false}
              onComplete={() => handleComplete(overtuiging.id)}
              isPending={completeOvertuigingMutation.isPending}
              recentlyCompleted={recentlyCompletedId === overtuiging.id}
            />
          ))}

          {/* Completed toggle */}
          {completedOvertuigingen.length > 0 && (
            <>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showCompleted ? "rotate-180" : ""}`} />
                {showCompleted ? "Verberg voltooide" : `Bekijk voltooide (${completedOvertuigingen.length})`}
              </button>
              {showCompleted && completedOvertuigingen.map(overtuiging => (
                <div key={overtuiging.id} className="opacity-60">
                  <OvertuigingCard
                    overtuiging={overtuiging}
                    categoryName={categoryNameMap.get(overtuiging.id)}
                    completed={true}
                    onComplete={() => {}}
                    isPending={false}
                    recentlyCompleted={false}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
