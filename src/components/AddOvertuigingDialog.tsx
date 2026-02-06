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
import { useUpdateProgram, useCreatePersoonlijkeOvertuiging } from "@/hooks/queries"
import type { Overtuiging } from "@/types/program"
import { Loader2, Lightbulb, Check, Plus } from "lucide-react"

interface AddOvertuigingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  programId: string
  currentOvertuigingen: string[]
  availableOvertuigingen: Overtuiging[]
}

export function AddOvertuigingDialog({
  open,
  onOpenChange,
  programId,
  currentOvertuigingen,
  availableOvertuigingen
}: AddOvertuigingDialogProps) {
  const { accessToken } = useAuth()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showPersonalForm, setShowPersonalForm] = useState(false)
  const [personalName, setPersonalName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const updateProgramMutation = useUpdateProgram()
  const createPersonalMutation = useCreatePersoonlijkeOvertuiging()

  const isPending = updateProgramMutation.isPending || createPersonalMutation.isPending

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelected(new Set())
      setShowPersonalForm(false)
      setPersonalName("")
      setError(null)
    }
  }, [open])

  const toggleOvertuiging = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!accessToken) return
    setError(null)

    try {
      // Add selected system overtuigingen to program
      if (selected.size > 0) {
        const updatedOvertuigingen = [...currentOvertuigingen, ...selected]
        await updateProgramMutation.mutateAsync({
          id: programId,
          data: { overtuigingen: updatedOvertuigingen },
          accessToken
        })
      }

      // Create personal overtuiging if form is filled
      if (showPersonalForm && personalName.trim()) {
        if (personalName.trim().length > 200) {
          setError("Naam mag maximaal 200 karakters zijn")
          return
        }
        await createPersonalMutation.mutateAsync({
          data: { name: personalName.trim(), programId },
          accessToken
        })
      }

      onOpenChange(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Er is een fout opgetreden"
      setError(errorMessage)
    }
  }

  const hasChanges = selected.size > 0 || (showPersonalForm && personalName.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Overtuiging toevoegen</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* System overtuigingen list */}
          {availableOvertuigingen.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Kies uit overtuigingen bij jouw doelstellingen
              </Label>
              <div className="space-y-2">
                {availableOvertuigingen.map(o => {
                  const isSelected = selected.has(o.id)
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggleOvertuiging(o.id)}
                      disabled={isPending}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                        isSelected
                          ? "bg-[#09637E]/15 border-2 border-[#09637E]"
                          : "bg-muted/50 border-2 border-transparent hover:bg-muted"
                      }`}
                    >
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isSelected ? "bg-[#09637E] text-white" : "bg-muted"
                      }`}>
                        {isSelected ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Lightbulb className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium text-sm">{o.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {availableOvertuigingen.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Alle overtuigingen bij jouw doelstellingen zijn al toegevoegd.
            </p>
          )}

          {/* Divider */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">of</span>
            </div>
          </div>

          {/* Personal overtuiging */}
          {!showPersonalForm ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowPersonalForm(true)}
              disabled={isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Eigen overtuiging toevoegen
            </Button>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="personal-overtuiging-name">Eigen overtuiging</Label>
              <Input
                id="personal-overtuiging-name"
                placeholder="bijv. Ik ben goed genoeg"
                value={personalName}
                onChange={(e) => setPersonalName(e.target.value)}
                maxLength={200}
                disabled={isPending}
                autoFocus
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleSave}
            disabled={isPending || !hasChanges}
            className="w-full"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selected.size > 0 && showPersonalForm && personalName.trim()
              ? `${selected.size + 1} toevoegen`
              : selected.size > 0
                ? `${selected.size} toevoegen`
                : "Toevoegen"
            }
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
      </DialogContent>
    </Dialog>
  )
}
