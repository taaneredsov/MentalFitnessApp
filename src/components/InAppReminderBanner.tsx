import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

function getTodayKey(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function isPermissionDenied(): boolean {
  if (typeof window === "undefined") return false
  if (!("Notification" in window)) return false
  return Notification.permission === "denied"
}

interface InAppReminderBannerProps {
  dueCount: number
}

export function InAppReminderBanner({ dueCount }: InAppReminderBannerProps) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false
    const key = localStorage.getItem("inapp-reminder-dismissed")
    return key === getTodayKey()
  })

  const shouldShow = useMemo(() => {
    if (dismissed) return false
    if (dueCount <= 0) return false
    return isPermissionDenied()
  }, [dismissed, dueCount])

  if (!shouldShow) return null

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Bell className="h-5 w-5 text-amber-700 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">Herinnering in app actief</p>
              <p className="text-sm text-amber-800">
                Je hebt vandaag {dueCount} geplande activite{dueCount === 1 ? "it" : "iten"}.
                Push notificaties staan uit in je browser.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-amber-700 hover:text-amber-900"
            onClick={() => {
              localStorage.setItem("inapp-reminder-dismissed", getTodayKey())
              setDismissed(true)
            }}
            aria-label="Sluit herinnering"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/account")}>
            Push instellingen
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
