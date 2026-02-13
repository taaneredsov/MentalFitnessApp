import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface ProgramExtendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (weeks: number) => Promise<void>
  isPending?: boolean
}

const EXTEND_OPTIONS = [
  { weeks: 2, label: "2 weken" },
  { weeks: 4, label: "4 weken" },
  { weeks: 6, label: "6 weken" }
]

export function ProgramExtendDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false
}: ProgramExtendDialogProps) {
  const [selectedWeeks, setSelectedWeeks] = useState(4)

  useEffect(() => {
    if (open) {
      setSelectedWeeks(4)
    }
  }, [open])

  const handleConfirm = async () => {
    await onConfirm(selectedWeeks)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Programma verlengen</DialogTitle>
          <DialogDescription>
            Kies met hoeveel weken je het programma wilt verlengen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {EXTEND_OPTIONS.map((option) => {
            const isSelected = selectedWeeks === option.weeks
            return (
              <button
                key={option.weeks}
                type="button"
                onClick={() => setSelectedWeeks(option.weeks)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verlengen...
              </>
            ) : (
              "Bevestig verlenging"
            )}
          </Button>
          <Button
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
