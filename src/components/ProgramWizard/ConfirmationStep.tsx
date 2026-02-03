import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, Clock, Target, CheckCircle2, Loader2 } from "lucide-react"
import type { StepProps } from "./types"

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  })
}

interface ConfirmationStepProps extends StepProps {
  onSave: () => void
}

export function ConfirmationStep({
  state,
  updateState,
  goalsData,
  daysData,
  methodsData,
  onBack,
  onSave
}: ConfirmationStepProps) {
  const selectedGoals = goalsData.filter((g) => state.goals.includes(g.id))
  const selectedDays = daysData.filter((d) => state.daysOfWeek.includes(d.id))
  const selectedMethods = methodsData.filter((m) => state.methods.includes(m.id))

  // Order days correctly
  const DAY_ORDER = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]
  const sortedDays = [...selectedDays].sort(
    (a, b) => DAY_ORDER.indexOf(a.name) - DAY_ORDER.indexOf(b.name)
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        <p className="text-sm text-muted-foreground mb-4">
          Controleer je programma voordat je het opslaat.
        </p>

        {/* Basic Info */}
        <div className="space-y-3 p-4 bg-background rounded-lg border mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Start</p>
              <p className="font-medium">{formatDate(state.startDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Duur</p>
              <p className="font-medium">{state.duration}</p>
            </div>
          </div>
        </div>

        {/* Goals */}
        {selectedGoals.length > 0 && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Doelen</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedGoals.map((goal) => (
                <span
                  key={goal.id}
                  className="px-3 py-1 text-sm rounded-full bg-primary/10 text-primary"
                >
                  {goal.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Schedule */}
        <div className="space-y-2 mb-4">
          <p className="text-sm font-medium">Schema</p>
          <div className="flex flex-wrap gap-2">
            {sortedDays.map((day) => (
              <span
                key={day.id}
                className="px-3 py-1 text-sm rounded-full bg-muted"
              >
                {day.name}
              </span>
            ))}
          </div>
        </div>

        {/* Methods */}
        {selectedMethods.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-sm font-medium">Methodes ({selectedMethods.length})</p>
            <ul className="space-y-1">
              {selectedMethods.map((method) => (
                <li key={method.id} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {method.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notities (optioneel)</Label>
          <Textarea
            id="notes"
            value={state.notes}
            onChange={(e) => updateState({ notes: e.target.value })}
            placeholder="Voeg eventuele notities toe..."
            rows={3}
            className="bg-background"
          />
        </div>
      </div>

      {/* Sticky navigation */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-background via-background to-transparent -mx-4 px-4 mt-6">
        <div className="flex justify-between border-t pt-4">
          <Button variant="outline" onClick={onBack} disabled={state.isSaving}>
            Terug
          </Button>
          <Button onClick={onSave} disabled={state.isSaving}>
            {state.isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Opslaan...
              </>
            ) : (
              "Programma Aanmaken"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
