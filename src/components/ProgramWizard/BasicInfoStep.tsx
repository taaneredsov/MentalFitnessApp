import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { DURATION_OPTIONS, type StepProps } from "./types"

export function BasicInfoStep({ state, updateState, onNext }: StepProps) {
  const today = new Date().toISOString().split("T")[0]
  const canProceed = state.startDate && state.duration && !state.isSaving

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="startDate">Startdatum</Label>
          <Input
            id="startDate"
            type="date"
            value={state.startDate}
            min={today}
            onChange={(e) => updateState({ startDate: e.target.value })}
            disabled={state.isSaving}
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Duur van programma</Label>
          <select
            id="duration"
            value={state.duration}
            onChange={(e) => updateState({ duration: e.target.value })}
            disabled={state.isSaving}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">Selecteer duur...</option>
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sticky navigation */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-background via-background to-transparent -mx-4 px-4 mt-auto">
        <div className="flex justify-end border-t pt-4">
          <Button onClick={onNext} disabled={!canProceed}>
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
