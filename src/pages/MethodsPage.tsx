import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useMethods, useGoals } from "@/hooks/queries"
import { Card } from "@/components/ui/card"
import type { Method } from "@/types/program"
import { Loader2, Clock, ChevronRight } from "lucide-react"

function MethodThumbnail({ photo, name }: { photo?: string; name: string }) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  // Show fallback if no photo, error, or still loading with broken src
  const showFallback = !photo || imgError

  return (
    <div className="w-full h-full relative">
      {/* Fallback - always rendered underneath */}
      <div className={`absolute inset-0 flex items-center justify-center bg-primary/10 p-4 ${showFallback ? 'opacity-100' : 'opacity-0'}`}>
        <img src="/pwa-512x512.svg" alt="" className="w-full h-full opacity-60" />
      </div>
      {/* Actual image */}
      {photo && !imgError && (
        <img
          src={photo}
          alt={name}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
        />
      )}
    </div>
  )
}

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
          <MethodThumbnail photo={method.photo} name={method.name} />
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

  // Use React Query for methods and goals data (cached)
  const { data: methods = [], isLoading: methodsLoading, error: methodsError } = useMethods()
  const { data: goals = [], isLoading: goalsLoading } = useGoals()

  const isLoading = methodsLoading || goalsLoading
  const error = methodsError ? "Kon methodes niet laden" : null

  // Filter out methods linked to "Goede gewoontes" goal
  const filteredMethods = useMemo(() => {
    const habitsGoal = goals.find(g => g.name === "Goede gewoontes")
    if (!habitsGoal) return methods
    return methods.filter(m => !m.linkedGoalIds?.includes(habitsGoal.id))
  }, [methods, goals])

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

      {filteredMethods.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Geen methodes beschikbaar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMethods.map(method => (
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
