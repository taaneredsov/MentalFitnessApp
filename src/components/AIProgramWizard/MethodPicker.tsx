import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Clock, Star, Plus } from "lucide-react"
import type { Method } from "@/types/program"

interface MethodPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableMethods: Method[]
  onSelect: (method: Method) => void
}

export function MethodPicker({
  open,
  onOpenChange,
  availableMethods,
  onSelect
}: MethodPickerProps) {
  const [search, setSearch] = useState("")

  // Sort methods: recommended first, then alphabetically
  const sortedMethods = useMemo(() => {
    const filtered = availableMethods.filter(m =>
      m.name.toLowerCase().includes(search.toLowerCase())
    )

    // Split into recommended and other
    // Note: We don't have linkedGoalIds in the Method type for frontend,
    // so we'll just sort alphabetically for now
    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }, [availableMethods, search])

  const handleSelect = (method: Method) => {
    onSelect(method)
    onOpenChange(false)
    setSearch("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Methode toevoegen</DialogTitle>
          <DialogDescription>
            Selecteer een methode om toe te voegen aan deze dag.
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek methode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Method list */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 max-h-[40vh]">
          {sortedMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Geen methodes gevonden
            </p>
          ) : (
            sortedMethods.map(method => (
              <div
                key={method.id}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
                onClick={() => handleSelect(method)}
              >
                {method.photo ? (
                  <img
                    src={method.photo}
                    alt={method.name}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Star className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{method.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{method.duration} min</span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="flex-shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
