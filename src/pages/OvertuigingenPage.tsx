import { useState, useMemo, useCallback } from "react"
import { useOvertuigingen, useMindsetCategories, useAllOvertuigingUsage, useCompleteOvertuiging, usePersoonlijkeOvertuigingen, useUpdatePersoonlijkeOvertuiging, useCreatePersoonlijkeOvertuiging, useDeletePersoonlijkeOvertuiging, usePrograms, useUpdateProgram } from "@/hooks/queries"
import { useAuth } from "@/contexts/AuthContext"
import { getTodayDate } from "@/lib/rewards-utils"
import { POINTS } from "@/types/rewards"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { OvertuigingUsageMap, MindsetCategory } from "@/types/program"
import { getRunningProgram } from "@/types/program"
import { Loader2, Search, X, Lightbulb, Check, Star, ChevronDown, Plus, Trash2 } from "lucide-react"

const EXCLUDED_SYSTEM_CATEGORY_NAME = "mijn eigen overtuigingen"
const PERSONAL_CATEGORY_ID = "__personal__"
const PERSONAL_CATEGORY_NAME = "Eigen overtuigingen"

function OvertuigingCard({
  title,
  categoryName,
  completed,
  onComplete,
  isPending,
  recentlyCompleted,
  onDelete,
  onAddToProgram
}: {
  title: string
  categoryName?: string
  completed: boolean
  onComplete: () => void
  isPending: boolean
  recentlyCompleted: boolean
  onDelete?: () => void
  onAddToProgram?: () => void
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
          <h3 className="font-medium text-sm break-words whitespace-normal">{title}</h3>
          {categoryName && (
            <p className="text-xs text-muted-foreground mt-0.5 break-words whitespace-normal">
              {categoryName}
            </p>
          )}
          {completed ? (
            <span className="text-xs text-[#007D72] font-medium mt-0.5">Voltooid</span>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5 break-words whitespace-normal">
              Programmeer de overtuiging met de balansmethode, en zet een vinkje wanneer afgerond.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {recentlyCompleted && (
            <span className="flex items-center gap-0.5 text-xs font-medium text-primary animate-in fade-in zoom-in duration-300">
              <Star className="h-3 w-3" />
              +{POINTS.overtuiging}
            </span>
          )}
          {onAddToProgram && !completed && (
            <button
              onClick={onAddToProgram}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-primary hover:bg-primary/10 transition-colors"
              aria-label="Toevoegen aan programma"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          {onDelete && !completed && (
            <button
              onClick={onDelete}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              aria-label="Overtuiging verwijderen"
            >
              <Trash2 className="h-4 w-4" />
            </button>
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [recentlyCompletedId, setRecentlyCompletedId] = useState<string | null>(null)

  const { user, accessToken } = useAuth()
  const today = useMemo(() => getTodayDate(), [])

  const { data: overtuigingen = [], isLoading: overtuigingenLoading, error: overtuigingenError } = useOvertuigingen()
  const { data: categories = [], isLoading: categoriesLoading } = useMindsetCategories()
  const { data: usageMap = {} as OvertuigingUsageMap } = useAllOvertuigingUsage()
  const { data: persoonlijkeOvertuigingen = [], isLoading: persoonlijkeLoading, error: persoonlijkeError } = usePersoonlijkeOvertuigingen()

  const [newOvertuigingName, setNewOvertuigingName] = useState("")

  const { data: programs = [] } = usePrograms(user?.id)
  const runningProgram = useMemo(() => getRunningProgram(programs), [programs])

  const completeOvertuigingMutation = useCompleteOvertuiging()
  const updatePersoonlijkeMutation = useUpdatePersoonlijkeOvertuiging()
  const createPersoonlijkeMutation = useCreatePersoonlijkeOvertuiging()
  const deletePersoonlijkeMutation = useDeletePersoonlijkeOvertuiging()
  const updateProgramMutation = useUpdateProgram()

  const programOvertuigingIds = useMemo(
    () => new Set(runningProgram?.overtuigingen || []),
    [runningProgram?.overtuigingen]
  )

  const isLoading = overtuigingenLoading || categoriesLoading || persoonlijkeLoading
  const error = overtuigingenError
    ? "Kon overtuigingen niet laden"
    : persoonlijkeError
      ? "Kon eigen overtuigingen niet laden"
      : null

  const isCompleted = useCallback((overtuigingId: string): boolean => {
    return usageMap[overtuigingId]?.completed === true
  }, [usageMap])

  const handleComplete = (overtuigingId: string) => {
    if (!user?.id || !accessToken) return
    if (isCompleted(overtuigingId)) return

    setRecentlyCompletedId(`system:${overtuigingId}`)
    setTimeout(() => setRecentlyCompletedId(null), 3000)

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

  const handleCompletePersoonlijke = (id: string) => {
    if (!accessToken) return

    setRecentlyCompletedId(`personal:${id}`)
    setTimeout(() => setRecentlyCompletedId(null), 3000)

    updatePersoonlijkeMutation.mutate({
      id,
      data: { status: "Afgerond" },
      accessToken
    }, {
      onError: () => {
        setRecentlyCompletedId(null)
      }
    })
  }

  const handleDeletePersoonlijke = (id: string) => {
    if (!accessToken) return
    deletePersoonlijkeMutation.mutate({ id, accessToken })
  }

  const handleAddToProgram = (overtuigingId: string) => {
    if (!accessToken || !runningProgram) return
    const currentIds = runningProgram.overtuigingen || []
    if (currentIds.includes(overtuigingId)) return
    updateProgramMutation.mutate({
      id: runningProgram.id,
      data: { overtuigingen: [...currentIds, overtuigingId] },
      accessToken
    })
  }

  const excludedCategoryIds = useMemo(() => {
    return new Set(
      categories
        .filter(cat => cat.name.toLowerCase().trim() === EXCLUDED_SYSTEM_CATEGORY_NAME)
        .map(cat => cat.id)
    )
  }, [categories])

  const visibleSystemOvertuigingen = useMemo(() => {
    if (excludedCategoryIds.size === 0) return overtuigingen
    return overtuigingen.filter(o => !o.categoryIds.some(cid => excludedCategoryIds.has(cid)))
  }, [overtuigingen, excludedCategoryIds])

  // Build category name lookup for visible system overtuigingen
  const categoryNameMap = useMemo(() => {
    const categoryById = new Map(categories.map(cat => [cat.id, cat.name]))
    const map = new Map<string, string>()
    visibleSystemOvertuigingen.forEach(o => {
      const categoryId = o.categoryIds.find(cid => !excludedCategoryIds.has(cid))
      if (!categoryId) return
      const categoryName = categoryById.get(categoryId)
      if (categoryName) map.set(o.id, categoryName)
    })
    return map
  }, [categories, excludedCategoryIds, visibleSystemOvertuigingen])

  // Categories available for filter chips (plus personal category)
  const availableCategories = useMemo(() => {
    const usedSystemCategoryIds = new Set<string>()
    visibleSystemOvertuigingen.forEach(o => {
      o.categoryIds.forEach(cid => {
        if (!excludedCategoryIds.has(cid)) {
          usedSystemCategoryIds.add(cid)
        }
      })
    })

    const systemCategories = categories
      .filter(cat => !excludedCategoryIds.has(cat.id) && usedSystemCategoryIds.has(cat.id))
      .sort((a: MindsetCategory, b: MindsetCategory) => (a.order ?? 0) - (b.order ?? 0))

    if (persoonlijkeOvertuigingen.length > 0) {
      return [{
        id: PERSONAL_CATEGORY_ID,
        name: PERSONAL_CATEGORY_NAME,
        overtuigingIds: [],
        goalIds: [],
        order: -1
      }, ...systemCategories]
    }

    return systemCategories
  }, [categories, excludedCategoryIds, visibleSystemOvertuigingen, persoonlijkeOvertuigingen.length])

  const normalizedQuery = searchQuery.toLowerCase().trim()

  // Filter + search (system overtuigingen)
  const filteredSystemOvertuigingen = useMemo(() => {
    let result = [...visibleSystemOvertuigingen].sort((a, b) => a.order - b.order)

    // If personal chip selected, hide system overtuigingen
    if (selectedCategoryId === PERSONAL_CATEGORY_ID) {
      return []
    }

    // Category filter
    if (selectedCategoryId) {
      result = result.filter(o => o.categoryIds.some(cid => cid === selectedCategoryId))
    }

    // Text search
    if (normalizedQuery) {
      result = result.filter(o => {
        if (o.name.toLowerCase().includes(normalizedQuery)) return true
        const catName = categoryNameMap.get(o.id)
        if (catName?.toLowerCase().includes(normalizedQuery)) return true
        return false
      })
    }

    return result
  }, [visibleSystemOvertuigingen, selectedCategoryId, normalizedQuery, categoryNameMap])

  // Filter + search (personal overtuigingen)
  const filteredPersoonlijkeOvertuigingen = useMemo(() => {
    let result = [...persoonlijkeOvertuigingen].sort((a, b) => a.name.localeCompare(b.name))

    // Personal overtuigingen are shown on "Alle" and dedicated personal chip
    if (selectedCategoryId && selectedCategoryId !== PERSONAL_CATEGORY_ID) {
      return []
    }

    if (normalizedQuery) {
      result = result.filter(o =>
        o.name.toLowerCase().includes(normalizedQuery) ||
        PERSONAL_CATEGORY_NAME.toLowerCase().includes(normalizedQuery)
      )
    }

    return result
  }, [persoonlijkeOvertuigingen, selectedCategoryId, normalizedQuery])

  // Split system overtuigingen into active and completed
  const activeOvertuigingen = useMemo(() => {
    return filteredSystemOvertuigingen.filter(o => !isCompleted(o.id))
  }, [filteredSystemOvertuigingen, isCompleted])

  const completedOvertuigingen = useMemo(() => {
    return filteredSystemOvertuigingen.filter(o => isCompleted(o.id))
  }, [filteredSystemOvertuigingen, isCompleted])

  const showAddInput = !selectedCategoryId || selectedCategoryId === PERSONAL_CATEGORY_ID

  const handleAddOvertuiging = () => {
    const trimmed = newOvertuigingName.trim()
    if (!trimmed || !accessToken) return
    createPersoonlijkeMutation.mutate({
      data: { name: trimmed },
      accessToken
    }, {
      onSuccess: () => setNewOvertuigingName("")
    })
  }

  const totalFilteredCount = filteredSystemOvertuigingen.length + filteredPersoonlijkeOvertuigingen.length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-5 py-6">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="px-5 py-6 space-y-6">
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

      {/* Category Filter Chips */}
      {availableCategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !selectedCategoryId
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Alle
          </button>
          {availableCategories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategoryId(
                selectedCategoryId === category.id ? null : category.id
              )}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategoryId === category.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {/* Inline input for adding eigen overtuigingen */}
      {showAddInput && (
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Nieuwe eigen overtuiging..."
            value={newOvertuigingName}
            onChange={(e) => setNewOvertuigingName(e.target.value.slice(0, 200))}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddOvertuiging() }}
            className="flex-1"
          />
          <button
            onClick={handleAddOvertuiging}
            disabled={!newOvertuigingName.trim() || createPersoonlijkeMutation.isPending}
            className="shrink-0 w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 transition-colors"
            aria-label="Overtuiging toevoegen"
          >
            {createPersoonlijkeMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Plus className="h-5 w-5" />
            }
          </button>
        </div>
      )}

      {totalFilteredCount === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery.trim() && selectedCategoryId
              ? "Geen overtuigingen gevonden voor deze combinatie."
              : searchQuery.trim()
                ? "Geen overtuigingen gevonden voor deze zoekopdracht."
                : selectedCategoryId
                  ? "Geen overtuigingen gevonden voor deze categorie."
                  : "Geen overtuigingen beschikbaar."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active system beliefs */}
          {activeOvertuigingen.map(overtuiging => (
            <OvertuigingCard
              key={overtuiging.id}
              title={overtuiging.name}
              categoryName={categoryNameMap.get(overtuiging.id)}
              completed={false}
              onComplete={() => handleComplete(overtuiging.id)}
              isPending={false}
              recentlyCompleted={recentlyCompletedId === `system:${overtuiging.id}`}
              onAddToProgram={runningProgram && !programOvertuigingIds.has(overtuiging.id) ? () => handleAddToProgram(overtuiging.id) : undefined}
            />
          ))}

          {/* Active personal beliefs */}
          {filteredPersoonlijkeOvertuigingen.map(item => (
            <OvertuigingCard
              key={item.id}
              title={item.name}
              categoryName={PERSONAL_CATEGORY_NAME}
              completed={false}
              onComplete={() => handleCompletePersoonlijke(item.id)}
              isPending={false}
              recentlyCompleted={recentlyCompletedId === `personal:${item.id}`}
              onDelete={() => handleDeletePersoonlijke(item.id)}
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
                    title={overtuiging.name}
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
