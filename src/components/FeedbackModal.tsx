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
import { Loader2 } from "lucide-react"

interface FeedbackModalProps {
  isOpen: boolean
  methodName: string
  onSubmit: (remark: string) => Promise<void>
  onSkip: () => void
}

export function FeedbackModal({
  isOpen,
  methodName,
  onSubmit,
  onSkip
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

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hoe was je sessie?</DialogTitle>
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
