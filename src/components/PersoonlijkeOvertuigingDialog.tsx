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
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { useCreatePersoonlijkeOvertuiging } from "@/hooks/queries"
import { Loader2 } from "lucide-react"

interface PersoonlijkeOvertuigingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  programId?: string
}

export function PersoonlijkeOvertuigingDialog({ open, onOpenChange, programId }: PersoonlijkeOvertuigingDialogProps) {
  const { accessToken } = useAuth()

  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const createMutation = useCreatePersoonlijkeOvertuiging()

  const isPending = createMutation.isPending

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setName("")
      setError(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Naam is verplicht")
      return
    }

    if (name.trim().length > 200) {
      setError("Naam mag maximaal 200 karakters zijn")
      return
    }

    if (!accessToken) {
      setError("Je bent niet ingelogd")
      return
    }

    try {
      await createMutation.mutateAsync({
        data: {
          name: name.trim(),
          programId
        },
        accessToken
      })
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
          <DialogTitle>Nieuwe Persoonlijke Overtuiging</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="overtuiging-name">Naam *</Label>
            <Input
              id="overtuiging-name"
              placeholder="bijv. Ik ben goed genoeg"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              disabled={isPending}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Toevoegen
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
