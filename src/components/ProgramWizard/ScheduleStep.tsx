import { Button } from "@/components/ui/button"
import { Check, Loader2 } from "lucide-react"
import type { StepProps } from "./types"

// Order days correctly (Monday first)
const DAY_ORDER = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]

export function ScheduleStep({ state, updateState, daysData, onNext, onBack, isLoading }: StepProps) {
  const toggleDay = (dayId: string) => {
    const newDays = state.daysOfWeek.includes(dayId)
      ? state.daysOfWeek.filter((id) => id !== dayId)
      : [...state.daysOfWeek, dayId]
    updateState({ daysOfWeek: newDays })
  }

  // Sort days according to DAY_ORDER
  const sortedDays = [...daysData].sort((a, b) => {
    return DAY_ORDER.indexOf(a.name) - DAY_ORDER.indexOf(b.name)
  })

  const canProceed = state.daysOfWeek.length > 0

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
          Selecteer de dagen waarop je wilt trainen.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {sortedDays.map((day) => {
            const isSelected = state.daysOfWeek.includes(day.id)
            return (
              <button
                key={day.id}
                onClick={() => toggleDay(day.id)}
                className={`p-3 rounded-lg border transition-colors text-center bg-background ${
                  isSelected
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center ${
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span>{day.name}</span>
                </div>
              </button>
            )
          })}
        </div>

        {state.daysOfWeek.length > 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            {state.daysOfWeek.length} dag{state.daysOfWeek.length !== 1 ? "en" : ""} per week geselecteerd
          </p>
        )}
      </div>

      {/* Sticky navigation */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-background via-background to-transparent -mx-4 px-4 mt-6">
        <div className="flex justify-between border-t pt-4">
          <Button variant="outline" onClick={onBack}>
            Terug
          </Button>
          <Button onClick={onNext} disabled={!canProceed}>
            Volgende
          </Button>
        </div>
      </div>
    </div>
  )
}
