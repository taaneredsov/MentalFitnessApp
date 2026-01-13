import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, Loader2, Sparkles } from "lucide-react"
import { DURATION_OPTIONS, DAY_ORDER, type AIInputFormProps } from "./types"

export function AIInputForm({
  state,
  updateState,
  goalsData,
  daysData,
  isLoading,
  onGenerate,
  onCancel
}: AIInputFormProps) {
  const today = new Date().toISOString().split("T")[0]

  const toggleGoal = (goalId: string) => {
    const newGoals = state.goals.includes(goalId)
      ? state.goals.filter((id) => id !== goalId)
      : [...state.goals, goalId]
    updateState({ goals: newGoals })
  }

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

  const canGenerate =
    state.goals.length > 0 &&
    state.startDate &&
    state.duration &&
    state.daysOfWeek.length > 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Goals Section */}
      <div className="space-y-3">
        <Label>Doelstellingen</Label>
        <p className="text-sm text-muted-foreground">
          Selecteer de doelen die je wilt bereiken.
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
      </div>

      {/* Date and Duration Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Startdatum</Label>
          <Input
            id="startDate"
            type="date"
            value={state.startDate}
            min={today}
            onChange={(e) => updateState({ startDate: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Duur</Label>
          <select
            id="duration"
            value={state.duration}
            onChange={(e) => updateState({ duration: e.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Selecteer...</option>
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Days Selection */}
      <div className="space-y-3">
        <Label>Trainingsdagen</Label>
        <p className="text-sm text-muted-foreground">
          Selecteer de dagen waarop je wilt trainen.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {sortedDays.map((day) => {
            const isSelected = state.daysOfWeek.includes(day.id)
            return (
              <button
                key={day.id}
                onClick={() => toggleDay(day.id)}
                className={`p-3 rounded-lg border transition-colors text-center ${
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
          <p className="text-sm text-muted-foreground">
            {state.daysOfWeek.length} dag{state.daysOfWeek.length !== 1 ? "en" : ""} per week geselecteerd
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onCancel}>
          Annuleren
        </Button>
        <Button onClick={onGenerate} disabled={!canGenerate}>
          <Sparkles className="mr-2 h-4 w-4" />
          Genereer Mijn Programma
        </Button>
      </div>
    </div>
  )
}
