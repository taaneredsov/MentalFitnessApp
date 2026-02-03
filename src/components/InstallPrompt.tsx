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

interface InstallPromptProps {
  variant?: "default" | "prominent"
}

export function InstallPrompt({ variant = "default" }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  // For prominent variant, start with true to show immediately
  const [showMobilePrompt, setShowMobilePrompt] = useState(variant === "prominent")
  const [dismissed, setDismissed] = useState(() => {
    // Check sessionStorage on initial render
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem("installPromptDismissed") === "true"
    }
    return false
  })
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window !== 'undefined') {
      return isInStandaloneMode()
    }
    return false
  })

  useEffect(() => {
    // Update standalone check (in case it changes)
    setIsStandalone(isInStandaloneMode())

    // Handle Android/Chrome install prompt
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // For default variant on iOS, show after delay
    if (variant !== "prominent" && isIOS()) {
      const timer = setTimeout(() => {
        setShowMobilePrompt(true)
      }, 2000)
      return () => {
        clearTimeout(timer)
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [variant])

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
    setShowMobilePrompt(false)
    setDeferredPrompt(null)
    sessionStorage.setItem("installPromptDismissed", "true")
  }

  // Don't show if dismissed or already installed
  if (dismissed || isStandalone) {
    return null
  }

  const cardClassName = variant === "prominent"
    ? "mb-4 border-primary/30 bg-primary/5 shadow-md"
    : "mx-4 mb-4 border-primary/20 bg-primary/5"

  // Android/Chrome prompt
  if (deferredPrompt) {
    return (
      <Card className={cardClassName}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              {variant === "prominent" ? (
                <>
                  <p className="font-semibold text-primary">TIP</p>
                  <p className="text-sm text-muted-foreground">
                    Voeg eerst de app toe aan je startscherm, en log dan in. Je blijft dan ingelogd.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Installeer de app</p>
                  <p className="text-sm text-muted-foreground">
                    Voeg toe aan je startscherm voor snelle toegang
                  </p>
                </>
              )}
            </div>
            {variant !== "prominent" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={handleInstallClick} className={variant === "prominent" ? "flex-1" : ""}>
              {variant === "prominent" ? "Installeer op startscherm" : "Installeren"}
            </Button>
            <Button variant="ghost" onClick={handleDismiss}>
              {variant === "prominent" ? "Overslaan" : "Later"}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Mobile prompt with instructions (iOS or Android without native prompt)
  if (showMobilePrompt && !deferredPrompt) {
    const iosDevice = isIOS()

    return (
      <Card className={cardClassName}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              {variant === "prominent" ? (
                <>
                  <p className="font-semibold text-primary">TIP</p>
                  <p className="text-sm text-muted-foreground">
                    Voeg eerst de app toe aan je startscherm, en log dan in. Je blijft dan ingelogd.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Installeer de app</p>
                  <p className="text-sm text-muted-foreground">
                    Voeg toe aan je startscherm voor snelle toegang
                  </p>
                </>
              )}
            </div>
            {variant !== "prominent" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="mt-3 rounded-lg bg-muted p-3">
            <p className="text-sm">
              <span className="font-medium">Stappen:</span>
            </p>
            {iosDevice ? (
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
            ) : (
              <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>1. Tik op het menu (⋮) rechtsboven</li>
                <li>
                  2. Tik op{" "}
                  <span className="font-medium">"Toevoegen aan startscherm"</span>
                </li>
              </ol>
            )}
          </div>
          <div className="mt-3">
            <Button variant="ghost" onClick={handleDismiss}>
              {variant === "prominent" ? "Overslaan en toch inloggen" : "Begrepen"}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
