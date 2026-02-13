import { useState, useMemo, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Check, Loader2, AlertTriangle, Sparkles, RefreshCw } from "lucide-react"
import type { ProgramDetail, Goal, Day } from "@/types/program"

interface ProgramEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  program: ProgramDetail | null
  allGoals: Goal[]
  allDays: Day[]
  onSave: (data: { goals: string[]; daysOfWeek: string[]; notes?: string }) => Promise<void>
  onRegenerate: (data: { daysOfWeek: string[]; goals?: string[]; regenerateMethod: "ai" | "simple"; force?: boolean }) => Promise<void>
  isSaving?: boolean
  isRegenerating?: boolean
  futureSessions?: number  // Number of future sessions that will be regenerated
}

/**
 * Goal checkbox item
 */
function GoalCheckboxItem({
  goal,
  isSelected,
  onToggle
}: {
  goal: Goal
  isSelected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        flex items-start gap-3 p-3 rounded-lg border text-left w-full transition-colors
        ${isSelected
          ? "bg-primary/10 border-primary"
          : "bg-card hover:bg-muted/50 border-border"
        }
      `}
    >
      <div className={`
        w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors
        ${isSelected
          ? "bg-primary border-primary"
          : "border-muted-foreground/40"
        }
      `}>
        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{goal.name}</p>
        {goal.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {goal.description}
          </p>
        )}
      </div>
    </button>
  )
}

/**
 * Day pill button
 */
function DayPill({
  day,
  isSelected,
  onToggle
}: {
  day: Day
  isSelected: boolean
  onToggle: () => void
}) {
  const shortName = day.name.slice(0, 2)

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        w-10 h-10 rounded-full text-sm font-medium transition-colors
        ${isSelected
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
        }
      `}
      title={day.name}
    >
      {shortName}
    </button>
  )
}

export function ProgramEditDialog({
  open,
  onOpenChange,
  program,
  allGoals,
  allDays,
  onSave,
  onRegenerate,
  isSaving = false,
  isRegenerating = false,
  futureSessions = 0
}: ProgramEditDialogProps) {
  // Local state for editing
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([])
  const [selectedDayIds, setSelectedDayIds] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)

  // Create a map from day name to day id for initialization
  const dayNameToId = useMemo(() => {
    return new Map(allDays.map(d => [d.name, d.id]))
  }, [allDays])

  // Store original values for comparison
  const [originalGoalIds, setOriginalGoalIds] = useState<string[]>([])
  const [originalDayIds, setOriginalDayIds] = useState<string[]>([])

  // Initialize state when dialog opens
  useEffect(() => {
    if (open && program) {
      const goalIds = program.goals || []
      const dayIds = (program.dayNames || [])
        .map(name => dayNameToId.get(name))
        .filter((id): id is string => id !== undefined)

      // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing form state from props when dialog opens
      setSelectedGoalIds(goalIds)
      setSelectedDayIds(dayIds)
      setOriginalGoalIds(goalIds)
      setOriginalDayIds(dayIds)
      setNotes(program.notes || "")
      setShowRegenerateConfirm(false)
    }
  }, [open, program, dayNameToId])

  // Filter out "Goede gewoontes" goal (habits)
  const selectableGoals = useMemo(() => {
    return allGoals.filter(g => g.name !== "Goede gewoontes")
  }, [allGoals])

  // Sort days in week order
  const sortedDays = useMemo(() => {
    const dayOrder = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]
    return [...allDays].sort((a, b) => {
      return dayOrder.indexOf(a.name) - dayOrder.indexOf(b.name)
    })
  }, [allDays])

  // Check if goals changed
  const goalsChanged = useMemo(() => {
    const originalSet = new Set(originalGoalIds)
    const currentSet = new Set(selectedGoalIds)
    if (originalSet.size !== currentSet.size) return true
    for (const id of originalSet) {
      if (!currentSet.has(id)) return true
    }
    return false
  }, [originalGoalIds, selectedGoalIds])

  // Check if days changed
  const daysChanged = useMemo(() => {
    const originalSet = new Set(originalDayIds)
    const currentSet = new Set(selectedDayIds)
    if (originalSet.size !== currentSet.size) return true
    for (const id of originalSet) {
      if (!currentSet.has(id)) return true
    }
    return false
  }, [originalDayIds, selectedDayIds])

  // Check if schedule-affecting changes were made (goals or days)
  const scheduleChanged = goalsChanged || daysChanged

  // Check if notes changed
  const notesChanged = useMemo(() => {
    if (!program) return false
    return (program.notes || "") !== notes
  }, [program, notes])

  // Check if there are any changes
  const hasChanges = scheduleChanged || notesChanged

  // Must have at least 1 goal and 1 day selected
  const canSave = selectedGoalIds.length >= 1 && selectedDayIds.length >= 1

  const isAIProgram = program?.creationType === "AI"
  const isLoading = isSaving || isRegenerating

  const handleToggleGoal = (goalId: string) => {
    setSelectedGoalIds(prev => {
      if (prev.includes(goalId)) {
        return prev.filter(id => id !== goalId)
      } else {
        return [...prev, goalId]
      }
    })
  }

  const handleToggleDay = (dayId: string) => {
    setSelectedDayIds(prev => {
      if (prev.includes(dayId)) {
        return prev.filter(id => id !== dayId)
      } else {
        return [...prev, dayId]
      }
    })
  }

  const handleSave = async () => {
    if (!canSave) return

    // If schedule changed, show regeneration confirmation
    if (scheduleChanged && futureSessions > 0) {
      setShowRegenerateConfirm(true)
      return
    }

    // Otherwise just save notes (no schedule regeneration needed)
    await onSave({
      goals: selectedGoalIds,
      daysOfWeek: selectedDayIds,
      notes: notes.trim() || undefined
    })
  }

  const handleRegenerate = async (method: "ai" | "simple") => {
    await onRegenerate({
      daysOfWeek: selectedDayIds,
      goals: goalsChanged ? selectedGoalIds : undefined,
      regenerateMethod: method,
      force: true  // Force regeneration even if future sessions have completed activities
    })
    setShowRegenerateConfirm(false)
  }

  const handleSaveNotesOnly = async () => {
    // Save only notes, keeping original goals and days
    await onSave({
      goals: originalGoalIds,
      daysOfWeek: originalDayIds,
      notes: notes.trim() || undefined
    })
  }

  if (!program) return null

  // Regeneration confirmation view
  if (showRegenerateConfirm) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Planning herberekenen?
            </DialogTitle>
            <DialogDescription>
              Je hebt de {daysChanged && "trainingsdagen"}{daysChanged && goalsChanged && " en "}{goalsChanged && "doelstellingen"} gewijzigd.
              Dit heeft gevolgen voor je planning.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Wat gebeurt er?</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Voltooide sessies (t/m vandaag) blijven behouden</li>
                <li>• {futureSessions} toekomstige sessie(s) worden herberekend</li>
                <li>• Activiteiten uitgevoerd op toekomstige sessies worden verwijderd</li>
              </ul>
            </div>

            {isAIProgram ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Kies een methode:</p>
                <Button
                  onClick={() => handleRegenerate("ai")}
                  disabled={isLoading}
                  className="w-full justify-start"
                  variant="outline"
                >
                  {isRegenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
                  )}
                  Automatische herberekening
                  <span className="ml-auto text-xs text-muted-foreground">Aanbevolen</span>
                </Button>
                <Button
                  onClick={() => handleRegenerate("simple")}
                  disabled={isLoading}
                  className="w-full justify-start"
                  variant="outline"
                >
                  {isRegenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Simpele herverdeling
                  <span className="ml-auto text-xs text-muted-foreground">Bestaande methodes</span>
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => handleRegenerate("simple")}
                disabled={isLoading}
                className="w-full"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Herberekenen...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Planning herberekenen
                  </>
                )}
              </Button>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="ghost"
              onClick={() => setShowRegenerateConfirm(false)}
              disabled={isLoading}
              className="w-full"
            >
              Terug naar bewerken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Main edit view
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bewerk programma</DialogTitle>
          <DialogDescription>
            Wijzig de doelstellingen, planning en notities.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4 py-4">
          {/* Goals Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Doelstellingen</Label>
            <p className="text-xs text-muted-foreground">
              Selecteer minimaal 1 doelstelling
            </p>
            <div className="max-h-[25vh] overflow-y-auto">
              <div className="space-y-2 pr-2">
                {selectableGoals.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic p-3">
                    Geen doelstellingen beschikbaar
                  </p>
                ) : (
                  selectableGoals.map(goal => (
                    <GoalCheckboxItem
                      key={goal.id}
                      goal={goal}
                      isSelected={selectedGoalIds.includes(goal.id)}
                      onToggle={() => handleToggleGoal(goal.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Schedule Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Trainingsdagen</Label>
            <p className="text-xs text-muted-foreground">
              Selecteer minimaal 1 dag per week
            </p>
            <div className="flex justify-between gap-1 pt-1">
              {sortedDays.map(day => (
                <DayPill
                  key={day.id}
                  day={day}
                  isSelected={selectedDayIds.includes(day.id)}
                  onToggle={() => handleToggleDay(day.id)}
                />
              ))}
            </div>
          </div>

          {/* Schedule change warning */}
          {scheduleChanged && futureSessions > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Het wijzigen van {daysChanged && "trainingsdagen"}{daysChanged && goalsChanged && " of "}{goalsChanged && "doelstellingen"} zal {futureSessions} toekomstige sessie(s) herberekenen.
                </p>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t" />

          {/* Notes Section */}
          <div className="space-y-2">
            <Label htmlFor="program-notes" className="text-sm font-medium">
              Notities
            </Label>
            <Textarea
              id="program-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Voeg eventuele notities toe..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleSave}
            disabled={!canSave || !hasChanges || isLoading}
            className="w-full"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Opslaan...
              </>
            ) : scheduleChanged && futureSessions > 0 ? (
              "Wijzigingen bekijken"
            ) : (
              "Opslaan"
            )}
          </Button>
          {notesChanged && scheduleChanged && (
            <Button
              variant="ghost"
              onClick={handleSaveNotesOnly}
              disabled={isLoading}
              className="w-full text-xs"
            >
              Alleen notities opslaan (planning behouden)
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full"
          >
            Annuleren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
