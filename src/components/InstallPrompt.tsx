import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Download, X, Share } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  )
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSPrompt, setShowIOSPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if already dismissed in this session
    const wasDismissed = sessionStorage.getItem("installPromptDismissed")
    if (wasDismissed) {
      setDismissed(true)
      return
    }

    // Don't show if already installed
    if (isInStandaloneMode()) {
      return
    }

    // Handle Android/Chrome install prompt
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // For iOS, show custom prompt after a short delay
    if (isIOS()) {
      const timer = setTimeout(() => {
        setShowIOSPrompt(true)
      }, 2000)
      return () => {
        clearTimeout(timer)
        window.removeEventListener(
          "beforeinstallprompt",
          handleBeforeInstallPrompt
        )
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    setShowIOSPrompt(false)
    setDeferredPrompt(null)
    sessionStorage.setItem("installPromptDismissed", "true")
  }

  // Don't show if dismissed or already installed
  if (dismissed || isInStandaloneMode()) {
    return null
  }

  // Android/Chrome prompt
  if (deferredPrompt) {
    return (
      <Card className="mx-4 mb-4 border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Installeer de app</p>
              <p className="text-sm text-muted-foreground">
                Voeg toe aan je startscherm voor snelle toegang
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={handleInstallClick} size="sm">
              Installeren
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Later
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // iOS prompt with instructions
  if (showIOSPrompt && isIOS()) {
    return (
      <Card className="mx-4 mb-4 border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Installeer de app</p>
              <p className="text-sm text-muted-foreground">
                Voeg toe aan je startscherm voor snelle toegang
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 rounded-lg bg-muted p-3">
            <p className="text-sm">
              <span className="font-medium">Stappen:</span>
            </p>
            <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                1. Tik op{" "}
                <Share className="inline h-4 w-4" />{" "}
                <span className="font-medium">Delen</span>
              </li>
              <li>2. Scroll naar beneden</li>
              <li>
                3. Tik op{" "}
                <span className="font-medium">"Zet op beginscherm"</span>
              </li>
            </ol>
          </div>
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Begrepen
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
