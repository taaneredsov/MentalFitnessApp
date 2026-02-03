import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, Loader2, Sparkles, AlertTriangle } from "lucide-react"
import { DURATION_OPTIONS, DAY_ORDER, AI_WIZARD_STEPS, type AIInputFormProps } from "./types"

/**
 * Calculate end date based on start date and duration string (e.g., "4 weken")
 */
function calculateEndDate(startDate: string, duration: string): string {
  const match = duration.match(/(\d+)/)
  const weeks = match ? parseInt(match[1], 10) : 4
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + (weeks * 7) - 1)
  return end.toISOString().split("T")[0]
}

/**
 * Check if two date ranges overlap
 */
function dateRangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return start1 <= end2 && end1 >= start2
}

export function AIInputForm({
  state,
  updateState,
  goalsData,
  daysData,
  existingPrograms,
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

  // Format date for display (e.g., "15 jan 2026")
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })
  }

  // Check for overlapping programs in Step 1
  const overlapCheck = useMemo(() => {
    if (!state.startDate || !state.duration) return null

    const newEndDate = calculateEndDate(state.startDate, state.duration)

    // Check against active/planned programs
    for (const program of existingPrograms) {
      if (program.status !== "Actief" && program.status !== "Gepland") continue

      if (program.startDate && program.endDate) {
        if (dateRangesOverlap(state.startDate, newEndDate, program.startDate, program.endDate)) {
          return {
            hasOverlap: true,
            programName: program.name || "Naamloos programma",
            programStartDate: program.startDate,
            programEndDate: program.endDate,
            programStatus: program.status
          }
        }
      }
    }

    return { hasOverlap: false, programName: null, programStartDate: null, programEndDate: null, programStatus: null }
  }, [state.startDate, state.duration, existingPrograms])

  // Validation per step
  const canProceedStep0 = state.goals.length > 0
  const canProceedStep1 = state.startDate && state.duration && !overlapCheck?.hasOverlap
  const canProceedStep2 = state.daysOfWeek.length > 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-h-[600px]">
      {/* Fixed header */}
      <div className="space-y-4 pb-4">
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
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {/* Step 0: Goals Selection */}
        {state.step === 0 && (
          <div className="space-y-2 pb-2">
            {goalsData.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Geen doelen beschikbaar.
              </p>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}

        {/* Step 1: Start Date and Duration */}
        {state.step === 1 && (
          <div className="space-y-6 pb-2">
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

            {/* Overlap warning */}
            {overlapCheck?.hasOverlap && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-red-800 dark:text-red-200 space-y-1">
                    <p className="font-medium">
                      Conflicterend programma gevonden
                    </p>
                    <p>
                      Je hebt al een {overlapCheck.programStatus?.toLowerCase()} programma "<strong>{overlapCheck.programName}</strong>" van{" "}
                      <strong>{formatDate(overlapCheck.programStartDate!)}</strong> t/m{" "}
                      <strong>{formatDate(overlapCheck.programEndDate!)}</strong>.
                    </p>
                    <p className="text-red-600 dark:text-red-400">
                      Kies een startdatum na {formatDate(overlapCheck.programEndDate!)} of verkort de duur.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Training Days */}
        {state.step === 2 && (
          <div className="space-y-6 pb-2">
            <div className="flex justify-between">
              {sortedDays.map((day) => {
                const isSelected = state.daysOfWeek.includes(day.id)
                const shortName = day.name.slice(0, 2)
                return (
                  <button
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    title={day.name}
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {shortName}
                  </button>
                )
              })}
            </div>

            <p className="text-sm text-muted-foreground text-center">
              {state.daysOfWeek.length === 0
                ? "Selecteer minimaal 1 dag"
                : `${state.daysOfWeek.length} dag${state.daysOfWeek.length !== 1 ? "en" : ""} per week geselecteerd`}
            </p>
          </div>
        )}

        {/* Scroll fade indicator */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Fixed footer with buttons */}
      <div className="border-t pt-4 mt-2 bg-background">
        {state.step === 0 && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={goBack} className="flex-1">
              Annuleren
            </Button>
            <Button onClick={goNext} disabled={!canProceedStep0} className="flex-1">
              Volgende
            </Button>
          </div>
        )}
        {state.step === 1 && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={goBack} className="flex-1">
              Terug
            </Button>
            <Button onClick={goNext} disabled={!canProceedStep1} className="flex-1">
              Volgende
            </Button>
          </div>
        )}
        {state.step === 2 && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={goBack}>
              Terug
            </Button>
            <Button onClick={onGenerate} disabled={!canProceedStep2} className="flex-1">
              <Sparkles className="mr-2 h-4 w-4" />
              Maak mijn programmavoorstel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
