import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { useCreatePersonalGoal, useUpdatePersonalGoal } from "@/hooks/queries"
import type { PersonalGoal } from "@/types/program"
import { Calendar, Check, ChevronDown, Loader2 } from "lucide-react"

const DAY_ORDER = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]

interface PersonalGoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal?: PersonalGoal | null  // If provided, edit mode; otherwise, create mode
}

export function PersonalGoalDialog({ open, onOpenChange, goal }: PersonalGoalDialogProps) {
  const { accessToken } = useAuth()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [scheduleDays, setScheduleDays] = useState<string[]>([])
  const [showSchedule, setShowSchedule] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createMutation = useCreatePersonalGoal()
  const updateMutation = useUpdatePersonalGoal()

  const isEditing = !!goal
  const isPending = createMutation.isPending || updateMutation.isPending

  const toggleDay = (day: string) => {
    setScheduleDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  // Reset form when dialog opens/closes or goal changes
  useEffect(() => {
    if (open) {
      if (goal) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing form state with prop
        setName(goal.name)
        setDescription(goal.description || "")
        setScheduleDays(goal.scheduleDays || [])
        setShowSchedule((goal.scheduleDays || []).length > 0)
      } else {
        setName("")
        setDescription("")
        setScheduleDays([])
        setShowSchedule(false)
      }
      setError(null)
    }
  }, [open, goal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Doelnaam is verplicht")
      return
    }

    if (name.trim().length > 200) {
      setError("Doelnaam mag maximaal 200 karakters zijn")
      return
    }

    if (description.length > 1000) {
      setError("Beschrijving mag maximaal 1000 karakters zijn")
      return
    }

    if (!accessToken) {
      setError("Je bent niet ingelogd")
      return
    }

    try {
      if (isEditing && goal) {
        await updateMutation.mutateAsync({
          id: goal.id,
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
            scheduleDays: scheduleDays.length > 0 ? scheduleDays : undefined
          },
          accessToken
        })
      } else {
        await createMutation.mutateAsync({
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
            scheduleDays: scheduleDays.length > 0 ? scheduleDays : undefined
          },
          accessToken
        })
      }
      onOpenChange(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Er is een fout opgetreden"
      setError(errorMessage)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Doel Bewerken" : "Nieuw Persoonlijk Doel"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-name">Naam *</Label>
            <Input
              id="goal-name"
              placeholder="bijv. Spreken tijdens vergadering"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              disabled={isPending}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-description">Beschrijving (optioneel)</Label>
            <Textarea
              id="goal-description"
              placeholder="Voeg een beschrijving toe..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              disabled={isPending}
              rows={3}
            />
          </div>

          {/* Planning section */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowSchedule(!showSchedule)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Calendar className="h-4 w-4" />
              <span>Planning (optioneel)</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showSchedule ? "rotate-180" : ""}`} />
            </button>

            {showSchedule && (
              <div className="space-y-3 pt-1">
                <p className="text-sm text-muted-foreground">
                  Selecteer de dagen waarop je dit doel wilt oefenen.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {DAY_ORDER.map(day => {
                    const isSelected = scheduleDays.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        disabled={isPending}
                        className={`p-3 rounded-lg border transition-colors bg-background ${
                          isSelected
                            ? "border-primary bg-primary/5 font-medium"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 shrink-0 rounded border flex items-center justify-center ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground"
                          }`}>
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <span>{day}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
                {scheduleDays.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {scheduleDays.length} dag{scheduleDays.length !== 1 ? "en" : ""} per week geselecteerd
                  </p>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Opslaan" : "Toevoegen"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="w-full"
            >
              Annuleren
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
