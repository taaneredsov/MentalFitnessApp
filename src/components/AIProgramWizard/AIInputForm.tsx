import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, Loader2, Sparkles } from "lucide-react"
import { DURATION_OPTIONS, DAY_ORDER, AI_WIZARD_STEPS, type AIInputFormProps } from "./types"

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

  const goNext = () => {
    if (state.step < AI_WIZARD_STEPS.length - 1) {
      updateState({ step: state.step + 1 })
    }
  }

  const goBack = () => {
    if (state.step > 0) {
      updateState({ step: state.step - 1 })
    } else {
      onCancel()
    }
  }

  // Validation per step
  const canProceedStep0 = state.goals.length > 0
  const canProceedStep1 = state.startDate && state.duration
  const canProceedStep2 = state.daysOfWeek.length > 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex justify-center gap-2">
        {AI_WIZARD_STEPS.map((_, index) => (
          <div
            key={index}
            className={`flex items-center ${index > 0 ? "ml-2" : ""}`}
          >
            {index > 0 && (
              <div
                className={`w-8 h-0.5 mr-2 ${
                  index <= state.step ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index === state.step
                  ? "bg-primary text-primary-foreground"
                  : index < state.step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {index + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Step title */}
      <div className="text-center">
        <h3 className="text-lg font-semibold">{AI_WIZARD_STEPS[state.step].title}</h3>
        <p className="text-sm text-muted-foreground">
          {AI_WIZARD_STEPS[state.step].description}
        </p>
      </div>

      {/* Step 0: Goals Selection */}
      {state.step === 0 && (
        <div className="space-y-4">
          {goalsData.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Geen doelen beschikbaar.
            </p>
          ) : (
            <div className="space-y-2">
              {goalsData
                .filter((goal) => goal.name !== "Goede gewoontes")
                .map((goal) => {
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
            <Button variant="outline" onClick={goBack}>
              Annuleren
            </Button>
            <Button onClick={goNext} disabled={!canProceedStep0}>
              Volgende
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Start Date and Duration */}
      {state.step === 1 && (
        <div className="space-y-6">
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
            <Label htmlFor="duration">Duur van programma</Label>
            <select
              id="duration"
              value={state.duration}
              onChange={(e) => updateState({ duration: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Selecteer duur...</option>
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={goBack}>
              Terug
            </Button>
            <Button onClick={goNext} disabled={!canProceedStep1}>
              Volgende
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Training Days */}
      {state.step === 2 && (
        <div className="space-y-4">
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

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={goBack}>
              Terug
            </Button>
            <Button onClick={onGenerate} disabled={!canProceedStep2}>
              <Sparkles className="mr-2 h-4 w-4" />
              Maak mijn programmavoorstel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
