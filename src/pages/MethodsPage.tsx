import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useMethods, useGoals } from "@/hooks/queries"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MethodThumbnail } from "@/components/MethodThumbnail"
import type { Method } from "@/types/program"
import { Loader2, Clock, ChevronRight, Search, X } from "lucide-react"

function MethodCard({
  method,
  onClick
}: {
  method: Method
  onClick: () => void
}) {
  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-lg bg-muted shrink-0 overflow-hidden">
          <MethodThumbnail photo={method.photo} name={method.name} className="w-full h-full" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h3 className="font-medium text-sm line-clamp-1">{method.name}</h3>
          {method.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {method.description}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{method.duration} min</span>
            </div>
            {method.experienceLevel && (
              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px]">
                {method.experienceLevel}
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <div className="flex items-center">
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </Card>
  )
}

export function MethodsPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")

  // Use React Query for methods and goals data (cached)
  const { data: methods = [], isLoading: methodsLoading, error: methodsError } = useMethods()
  const { data: goals = [], isLoading: goalsLoading } = useGoals()

  const isLoading = methodsLoading || goalsLoading
  const error = methodsError ? "Kon methodes niet laden" : null

  // Goal lookup map for efficient filtering
  const goalNameMap = useMemo(() => {
    const map = new Map<string, string>()
    goals.forEach(goal => map.set(goal.id, goal.name.toLowerCase()))
    return map
  }, [goals])

  // Filter out methods linked to "Goede gewoontes" goal
  const filteredMethods = useMemo(() => {
    const habitsGoal = goals.find(g => g.name === "Goede gewoontes")
    if (!habitsGoal) return methods
    return methods.filter(m => !m.linkedGoalIds?.includes(habitsGoal.id))
  }, [methods, goals])

  // Search filter (on top of existing filter)
  const searchedMethods = useMemo(() => {
    if (!searchQuery.trim()) return filteredMethods

    const query = searchQuery.toLowerCase().trim()

    return filteredMethods.filter(method => {
      // Match method name
      if (method.name.toLowerCase().includes(query)) return true

      // Match linked goal names
      if (method.linkedGoalIds?.some(goalId => {
        const goalName = goalNameMap.get(goalId)
        return goalName?.includes(query)
      })) return true

      return false
    })
  }, [filteredMethods, searchQuery, goalNameMap])

  const handleMethodClick = (id: string) => {
    navigate(`/methods/${id}`)
  }

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
      <h2 className="text-2xl font-bold">Methodes</h2>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Zoek methodes..."
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

      {searchedMethods.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery.trim()
              ? "Geen methodes gevonden voor deze zoekopdracht."
              : "Geen methodes beschikbaar."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {searchedMethods.map(method => (
            <MethodCard
              key={method.id}
              method={method}
              onClick={() => handleMethodClick(method.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
