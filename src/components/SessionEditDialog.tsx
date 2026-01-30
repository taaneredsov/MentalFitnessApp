import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Plus, Clock, Loader2 } from "lucide-react"
import type { Programmaplanning, Method } from "@/types/program"

interface SessionEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: Programmaplanning | null
  availableMethods: Method[]
  onSave: (planningId: string, methodIds: string[]) => Promise<void>
  isSaving?: boolean
}

/**
 * Format date in Dutch locale
 * Output: "Vrijdag 31 januari"
 */
function formatSessionDate(dateStr: string): string {
  const date = new Date(dateStr)
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long"
  }
  // Capitalize first letter
  const formatted = new Intl.DateTimeFormat("nl-NL", options).format(date)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

/**
 * Method item in the current methods list (with remove option)
 */
function CurrentMethodItem({
  method,
  isRemovable,
  onRemove
}: {
  method: Method
  isRemovable: boolean
  onRemove: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {method.photo && (
          <img
            src={method.photo}
            alt=""
            className="w-10 h-10 rounded-lg object-cover shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{method.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {method.duration} min
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={onRemove}
        disabled={!isRemovable}
        className="p-2 hover:bg-destructive/10 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label={`Verwijder ${method.name}`}
        title={!isRemovable ? "Sessie moet minstens 1 methode bevatten" : `Verwijder ${method.name}`}
      >
        <X className="h-4 w-4 text-destructive" />
      </button>
    </div>
  )
}

/**
 * Method item in the available methods list (with add option)
 */
function AvailableMethodItem({
  method,
  onAdd
}: {
  method: Method
  onAdd: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {method.photo && (
          <img
            src={method.photo}
            alt=""
            className="w-10 h-10 rounded-lg object-cover shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{method.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {method.duration} min
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={onAdd}
        className="p-2 hover:bg-primary/10 rounded-md transition-colors"
        aria-label={`Voeg ${method.name} toe aan sessie`}
      >
        <Plus className="h-4 w-4 text-primary" />
      </button>
    </div>
  )
}

export function SessionEditDialog({
  open,
  onOpenChange,
  session,
  availableMethods,
  onSave,
  isSaving = false
}: SessionEditDialogProps) {
  // Local state for selected method IDs
  const [selectedMethodIds, setSelectedMethodIds] = useState<string[]>([])

  // Reset state when dialog opens with new session
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && session) {
      setSelectedMethodIds(session.methodIds || [])
    }
    onOpenChange(newOpen)
  }

  // Get method details for selected methods
  const selectedMethods = useMemo(() => {
    const methodMap = new Map(availableMethods.map(m => [m.id, m]))
    return selectedMethodIds
      .map(id => methodMap.get(id))
      .filter((m): m is Method => m !== undefined)
  }, [selectedMethodIds, availableMethods])

  // Get methods that can still be added (not already selected)
  const methodsToAdd = useMemo(() => {
    const selectedSet = new Set(selectedMethodIds)
    return availableMethods.filter(m => !selectedSet.has(m.id))
  }, [availableMethods, selectedMethodIds])

  // Calculate total session time
  const totalTime = useMemo(() => {
    return selectedMethods.reduce((sum, m) => sum + (m.duration || 0), 0)
  }, [selectedMethods])

  // Can remove a method only if more than 1 remains
  const canRemoveMethod = selectedMethodIds.length > 1

  // Can save if at least 1 method selected
  const canSave = selectedMethodIds.length >= 1

  // Check if there are changes from original
  const hasChanges = useMemo(() => {
    if (!session) return false
    const original = new Set(session.methodIds || [])
    const current = new Set(selectedMethodIds)
    if (original.size !== current.size) return true
    for (const id of original) {
      if (!current.has(id)) return true
    }
    return false
  }, [session, selectedMethodIds])

  const handleRemove = (methodId: string) => {
    if (canRemoveMethod) {
      setSelectedMethodIds(prev => prev.filter(id => id !== methodId))
    }
  }

  const handleAdd = (methodId: string) => {
    if (!selectedMethodIds.includes(methodId)) {
      setSelectedMethodIds(prev => [...prev, methodId])
    }
  }

  const handleSave = async () => {
    if (session && canSave) {
      await onSave(session.id, selectedMethodIds)
    }
  }

  if (!session) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bewerk sessie van {formatSessionDate(session.date)}</DialogTitle>
          <DialogDescription>
            Voeg methodes toe of verwijder ze van deze sessie.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* Current Methods Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Huidige methodes</h4>
              <span className="text-sm text-muted-foreground">
                {totalTime} min totaal
              </span>
            </div>
            <ScrollArea className="max-h-[25vh]">
              <div className="space-y-2 pr-4">
                {selectedMethods.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic p-3">
                    Geen methodes geselecteerd
                  </p>
                ) : (
                  selectedMethods.map(method => (
                    <CurrentMethodItem
                      key={method.id}
                      method={method}
                      isRemovable={canRemoveMethod}
                      onRemove={() => handleRemove(method.id)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Add Methods Section */}
          <div className="space-y-2 flex-1 min-h-0">
            <h4 className="text-sm font-medium">Methode toevoegen</h4>
            <ScrollArea className="max-h-[25vh]">
              <div className="space-y-2 pr-4">
                {methodsToAdd.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic p-3">
                    Alle beschikbare methodes zijn al toegevoegd
                  </p>
                ) : (
                  methodsToAdd.map(method => (
                    <AvailableMethodItem
                      key={method.id}
                      method={method}
                      onAdd={() => handleAdd(method.id)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Annuleren
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave || !hasChanges || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Opslaan...
              </>
            ) : (
              "Opslaan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
