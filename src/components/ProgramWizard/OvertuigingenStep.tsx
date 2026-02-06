import { useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Check, Loader2 } from "lucide-react"
import { useOvertuigingsByGoals } from "@/hooks/queries"
import type { StepProps } from "./types"

export function OvertuigingenStep({ state, updateState, onNext, onBack }: StepProps) {
  const { data: overtuigingen = [], isLoading } = useOvertuigingsByGoals(state.goals)

  // Sort by order
  const sorted = useMemo(() => {
    return [...overtuigingen].sort((a, b) => a.order - b.order)
  }, [overtuigingen])

  // Auto-select up to 3 on first load (only if none selected yet)
  useEffect(() => {
    if (sorted.length > 0 && state.overtuigingen.length === 0) {
      const autoSelected = sorted.slice(0, 3).map(o => o.id)
      updateState({ overtuigingen: autoSelected })
    }
  }, [sorted, state.overtuigingen.length, updateState])

  const toggleOvertuiging = (id: string) => {
    const newSelection = state.overtuigingen.includes(id)
      ? state.overtuigingen.filter(oId => oId !== id)
      : [...state.overtuigingen, id]
    updateState({ overtuigingen: newSelection })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        <p className="text-sm text-muted-foreground mb-4">
          Selecteer de overtuigingen die je wilt oefenen. (Optioneel)
        </p>

        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Geen overtuigingen beschikbaar voor je gekozen doelen.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {sorted.map(overtuiging => {
                const isSelected = state.overtuigingen.includes(overtuiging.id)
                return (
                  <button
                    key={overtuiging.id}
                    onClick={() => toggleOvertuiging(overtuiging.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors bg-background ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div>
                        <p className="font-medium">{overtuiging.name}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Je kunt later meer toevoegen.
            </p>
          </>
        )}
      </div>

      {/* Sticky navigation */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-background via-background to-transparent -mx-4 px-4 mt-6">
        <div className="flex justify-between border-t pt-4">
          <Button variant="outline" onClick={onBack} disabled={state.isSaving}>
            Terug
          </Button>
          <Button onClick={onNext} disabled={state.isSaving}>
            {state.isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Bezig...
              </>
            ) : (
              "Volgende"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
