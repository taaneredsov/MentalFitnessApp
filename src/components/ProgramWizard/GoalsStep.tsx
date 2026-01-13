import { Button } from "@/components/ui/button"
import { Check, Loader2 } from "lucide-react"
import type { StepProps } from "./types"

export function GoalsStep({ state, updateState, goalsData, onNext, onBack, isLoading }: StepProps) {
  const toggleGoal = (goalId: string) => {
    const newGoals = state.goals.includes(goalId)
      ? state.goals.filter((id) => id !== goalId)
      : [...state.goals, goalId]
    updateState({ goals: newGoals })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Selecteer de doelen die je wilt bereiken met dit programma. (Optioneel)
      </p>

      {goalsData.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Geen doelen beschikbaar.
        </p>
      ) : (
        <div className="space-y-2">
          {goalsData.map((goal) => {
            const isSelected = state.goals.includes(goal.id)
            return (
              <button
                key={goal.id}
                onClick={() => toggleGoal(goal.id)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
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
                    <p className="font-medium">{goal.name}</p>
                    {goal.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {goal.description}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex justify-between pt-4">
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
  )
}
