import { useState } from "react"
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
import { Loader2, Star } from "lucide-react"
import { POINTS } from "@/types/rewards"

interface FeedbackModalProps {
  isOpen: boolean
  methodName: string
  onSubmit: (remark: string) => Promise<void>
  onSkip: () => void
  pointsAwarded?: number
}

export function FeedbackModal({
  isOpen,
  methodName,
  onSubmit,
  onSkip,
  pointsAwarded
}: FeedbackModalProps) {
  const [remark, setRemark] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onSubmit(remark)
      setRemark("")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    setRemark("")
    onSkip()
  }

  const points = pointsAwarded ?? POINTS.method

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Hoe was je sessie?
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-sm font-normal">
              <Star className="h-3.5 w-3.5" />
              +{points}
            </span>
          </DialogTitle>
          <DialogDescription>
            Je hebt "{methodName}" afgerond. Deel je ervaring (optioneel).
          </DialogDescription>
        </DialogHeader>

        <Textarea
          placeholder="Hoe voelde je je tijdens de oefening? Wat viel je op?"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          className="min-h-[100px]"
          disabled={isSubmitting}
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isSubmitting}
          >
            Overslaan
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
