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
import { Loader2 } from "lucide-react"

interface PersonalGoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal?: PersonalGoal | null  // If provided, edit mode; otherwise, create mode
}

export function PersonalGoalDialog({ open, onOpenChange, goal }: PersonalGoalDialogProps) {
  const { accessToken } = useAuth()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)

  const createMutation = useCreatePersonalGoal()
  const updateMutation = useUpdatePersonalGoal()

  const isEditing = !!goal
  const isPending = createMutation.isPending || updateMutation.isPending

  // Reset form when dialog opens/closes or goal changes
  useEffect(() => {
    if (open) {
      if (goal) {
        setName(goal.name)
        setDescription(goal.description || "")
      } else {
        setName("")
        setDescription("")
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
            description: description.trim() || undefined
          },
          accessToken
        })
      } else {
        await createMutation.mutateAsync({
          data: {
            name: name.trim(),
            description: description.trim() || undefined
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

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Opslaan" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
