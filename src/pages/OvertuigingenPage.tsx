import { useState, useMemo } from "react"
import { useOvertuigingen, useGoals, useMindsetCategories } from "@/hooks/queries"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Overtuiging } from "@/types/program"
import { Loader2, Search, X, Lightbulb } from "lucide-react"

function LevelDots({ count = 3 }: { count?: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-full bg-muted"
        />
      ))}
    </div>
  )
}

function OvertuigingCard({ overtuiging, categoryName }: { overtuiging: Overtuiging; categoryName?: string }) {
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
          <div className="mt-1.5">
            <LevelDots />
          </div>
        </div>
      </div>
    </Card>
  )
}

export function OvertuigingenPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)

  const { data: overtuigingen = [], isLoading: overtuigingenLoading, error: overtuigingenError } = useOvertuigingen()
  const { data: goals = [], isLoading: goalsLoading } = useGoals()
  const { data: categories = [], isLoading: categoriesLoading } = useMindsetCategories()

  const isLoading = overtuigingenLoading || goalsLoading || categoriesLoading
  const error = overtuigingenError ? "Kon overtuigingen niet laden" : null

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
          {filteredOvertuigingen.map(overtuiging => (
            <OvertuigingCard
              key={overtuiging.id}
              overtuiging={overtuiging}
              categoryName={categoryNameMap.get(overtuiging.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
