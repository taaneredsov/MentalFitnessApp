import { useState, useMemo, useCallback, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/AuthContext"
import { usePrograms, useProgram } from "@/hooks/queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Programmaplanning } from "@/types/program"
import {
  getProgramStatus,
  getNextScheduledDay,
  formatNextDay,
  getSessionProgress,
  hasRunningProgram,
  getRunningProgram
} from "@/types/program"
import {
  Calendar,
  Clock,
  Target,
  Loader2,
  ChevronRight,
  Sparkles,
  CheckCircle
} from "lucide-react"
import { InstallPrompt } from "@/components/InstallPrompt"
import { AIProgramWizard } from "@/components/AIProgramWizard"
import { PullToRefreshWrapper } from "@/components/PullToRefresh"
import { GoodHabitsSection } from "@/components/GoodHabitsSection"
import { PersonalGoalsSection } from "@/components/PersonalGoalsSection"
import { ScoreWidgets } from "@/components/ScoreWidgets"
import { WelcomeScreen, GuidedTour, HOMEPAGE_TOUR_STEPS } from "@/components/Onboarding"
import { MethodThumbnail } from "@/components/MethodThumbnail"
import { useOnboarding } from "@/hooks/useOnboarding"

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short"
  })
}

/**
 * Get local date in YYYY-MM-DD format (not UTC)
 */
function getLocalDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Find the next scheduled session from the program schedule
 * Returns today's session if available, otherwise the next upcoming session
 */
function getNextScheduledSession(schedule: Programmaplanning[]): Programmaplanning | null {
  if (!schedule?.length) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = getLocalDateStr(today)

  // Find today's session first
  const todaySession = schedule.find(s => s.date === todayStr)
  if (todaySession) return todaySession

  // Find next upcoming session
  return schedule.find(s => {
    const sessionDate = new Date(s.date)
    sessionDate.setHours(0, 0, 0, 0)
    return sessionDate > today
  }) || null
}


export function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [onboardingInProgress, setOnboardingInProgress] = useState(false)
  const [showWelcomeInWizard, setShowWelcomeInWizard] = useState(true)

  // Onboarding state (for tour only now)
  const {
    shouldShowTour,
    markTourCompleted,
    markTourSkipped
  } = useOnboarding()

  const firstName = user?.name?.split(" ")[0] || "there"

  // Check if we should start the tour (coming from first program creation)
  useEffect(() => {
    const state = location.state as { startTour?: boolean } | null
    if (state?.startTour && shouldShowTour) {
      // Clear the state to prevent re-triggering
      navigate(location.pathname, { replace: true, state: {} })
      // Dismiss install prompt so it doesn't interfere with tour spotlight
      sessionStorage.setItem("installPromptDismissed", "true")
      // Delay tour start to let page render
      setTimeout(() => setShowTour(true), 500)
    }
  }, [location, shouldShowTour, navigate])

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["programs"] }),
      queryClient.invalidateQueries({ queryKey: ["program"] })
    ])
  }, [queryClient])

  // Use React Query for programs (cached)
  const { data: programs = [], isLoading: programsLoading } = usePrograms(user?.id)

  // Find the running program
  const runningProgramBasic = useMemo(
    () => programs.find(p => getProgramStatus(p) === "running"),
    [programs]
  )

  // Fetch full program details if we have a running program
  const { data: runningProgram, isLoading: detailLoading } = useProgram(
    runningProgramBasic?.id || ""
  )

  const isLoading = programsLoading || (runningProgramBasic && detailLoading)
  const hasNoPrograms = !programsLoading && programs.length === 0

  // Check if user already has a running program (for one-active-program limit)
  const userHasRunningProgram = !programsLoading && hasRunningProgram(programs)
  const currentRunningProgram = getRunningProgram(programs)

  // Auto-show onboarding for first-time users (only if no running program)
  // Keep showing if onboardingInProgress is true (prevents auto-hide when program is created)
  const shouldShowOnboardingWizard = onboardingInProgress || (!userHasRunningProgram && (showOnboarding || (hasNoPrograms && !programsLoading)))

  // Check if we should show welcome screen first (always show before wizard)
  const shouldShowWelcomeScreen = shouldShowOnboardingWizard && showWelcomeInWizard

  // Reset welcome screen state when wizard closes
  useEffect(() => {
    if (!shouldShowOnboardingWizard) {
      setShowWelcomeInWizard(true)
    }
  }, [shouldShowOnboardingWizard])

  const handleWelcomeStart = () => {
    setShowWelcomeInWizard(false)
    setOnboardingInProgress(true)
  }

  const handleOnboardingComplete = (_programId: string) => {
    setShowOnboarding(false)
    setOnboardingInProgress(false)
    // Navigate to homepage with tour trigger (instead of program detail)
    navigate("/", { replace: true, state: { startTour: true } })
  }

  const handleTourComplete = () => {
    markTourCompleted()
    setShowTour(false)
  }

  const handleTourSkip = (step: number) => {
    markTourSkipped(step)
    setShowTour(false)
  }

  const nextDay = runningProgram
    ? getNextScheduledDay(runningProgram.dayNames)
    : null

  // Find the next scheduled session (for programmaplanningId navigation)
  const nextSession = runningProgram
    ? getNextScheduledSession(runningProgram.schedule)
    : null

  // Filter methods to only show today's scheduled methods
  const todaysMethods = useMemo(() => {
    const methodDetails = runningProgram?.methodDetails
    const nextMethodIds = nextSession?.methodIds
    if (!nextMethodIds || !methodDetails) return []
    const methodIdSet = new Set(nextMethodIds)
    return methodDetails.filter(m => methodIdSet.has(m.id))
  }, [runningProgram?.methodDetails, nextSession?.methodIds])

  // Calculate total time for today's methods
  const todaysSessionTime = useMemo(() => {
    return todaysMethods.reduce((sum, m) => sum + (m.duration || 0), 0)
  }, [todaysMethods])

  // Show blocking message if user tries to create program while having one running
  if (showOnboarding && userHasRunningProgram && currentRunningProgram) {
    return (
      <div className="py-6 px-4 space-y-6">
        <section>
          <h2 className="text-2xl font-bold mb-1">Welkom terug, {firstName}!</h2>
        </section>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Je hebt al een actief programma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Je kunt slechts één programma tegelijk volgen. Voltooi of bewerk je huidige programma eerst.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate(`/programs/${currentRunningProgram.id}`)}
              >
                Bekijk huidig programma
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowOnboarding(false)}
              >
                Terug
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show welcome screen for first-time users
  if (shouldShowWelcomeScreen) {
    return <WelcomeScreen onStart={handleWelcomeStart} />
  }

  // Show onboarding wizard for first-time users (after welcome screen)
  if (shouldShowOnboardingWizard) {
    return (
      <div className="py-6 px-4 space-y-6">
        <section>
          <h2 className="text-2xl font-bold mb-1">Welkom, {firstName}!</h2>
          <p className="text-muted-foreground">
            Laten we je eerste programma maken om te beginnen met je mentale fitness reis.
          </p>
        </section>

        <AIProgramWizard
          onComplete={handleOnboardingComplete}
          onCancel={() => setShowOnboarding(false)}
        />
      </div>
    )
  }

  return (
    <PullToRefreshWrapper onRefresh={handleRefresh}>
      <div className="px-4 py-8 space-y-6">
        <section>
          <h2 className="text-3xl font-bold mb-2">Hello, {firstName}!</h2>
          <p className="text-lg text-muted-foreground">
            Welkom bij je persoonlijke mentale fitness-coach.
          </p>
        </section>

        {/* Hide install prompt during tour to avoid spotlight issues */}
        {!showTour && <InstallPrompt />}

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : runningProgram ? (
          <section className="grid gap-4">
          {/* TODAY'S ACTIVITY - Most Prominent */}
          {nextDay && (
            <Card data-tour="activity" className="border-primary/30 shadow-md overflow-hidden">
              <CardHeader className="pb-3 pt-4 bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      {nextDay.isToday
                        ? "Activiteit van Vandaag"
                        : "Volgende Activiteit"}
                    </CardTitle>
                    <p className="text-sm text-primary font-medium">
                      {formatNextDay(nextDay)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {todaysMethods.length > 0 && (
                  <div className="space-y-3">
                    {todaysMethods.map(method => {
                      const isMethodCompleted = nextSession?.completedMethodIds?.includes(method.id) ?? false
                      return (
                        <div
                          key={method.id}
                          className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98] ${
                            isMethodCompleted
                              ? "bg-primary/10 ring-2 ring-primary/30"
                              : "bg-muted/50"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/methods/${method.id}`, {
                              state: {
                                programmaplanningId: nextSession?.id,
                                programId: runningProgram.id
                              }
                            })
                          }}
                        >
                          <MethodThumbnail photo={method.photo} name={method.name} className="w-12 h-12 rounded-xl" />
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold truncate ${isMethodCompleted ? "text-primary" : ""}`}>
                              {method.name}
                            </p>
                            {method.duration > 0 && (
                              <p className="text-sm text-muted-foreground">
                                {method.duration} min
                              </p>
                            )}
                          </div>
                          {isMethodCompleted ? (
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                              <CheckCircle className="h-5 w-5 text-primary-foreground" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                              <ChevronRight className="h-5 w-5 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {todaysSessionTime > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Totaal: {todaysSessionTime} minuten</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div data-tour="scores">
            <ScoreWidgets />
          </div>

          {/* Program Progress Card */}
          <Card
            data-tour="progress"
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/programs/${runningProgram.id}`)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Huidig Programma</CardTitle>
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
              {runningProgram.name && (
                <p className="text-muted-foreground mt-1">
                  {runningProgram.name}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">
                    {formatDate(runningProgram.startDate)} -{" "}
                    {formatDate(runningProgram.endDate)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Target className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{runningProgram.frequency}x per week</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Voortgang</span>
                  <span className="font-medium">{getSessionProgress(runningProgram)}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${getSessionProgress(runningProgram)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

        </section>
        ) : (
          <section className="grid gap-4">
            <ScoreWidgets />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Geen Actief Programma</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Je hebt momenteel geen actief programma. Bekijk je programma's
                  om te starten.
                </p>
              </CardContent>
            </Card>
          </section>
        )}

        <section data-tour="goals" className="grid gap-4">
          <PersonalGoalsSection />
        </section>

        <section data-tour="habits" className="grid gap-4">
          <GoodHabitsSection />
        </section>

        <section className="grid gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Hulp & Informatie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Heb je vragen over de app of je mentale fitnessprogramma? Hier vind je antwoorden.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm">💡</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Hoe werkt het puntensysteem?</p>
                    <p className="text-xs text-muted-foreground">
                      Verdien punten door methodes te voltooien (10 pts), gewoontes bij te houden (5 pts) en persoonlijke doelen te behalen (10 pts).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm">🔥</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Wat is een streak?</p>
                    <p className="text-xs text-muted-foreground">
                      Je streak telt het aantal opeenvolgende dagen dat je actief bent geweest. Blijf elke dag bezig om je streak te behouden!
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm">📅</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Kan ik mijn programma aanpassen?</p>
                    <p className="text-xs text-muted-foreground">
                      Ja! Ga naar je programma details en tik op "Bewerk programma" om doelen, trainingsdagen of notities te wijzigen.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Guided Tour */}
      {showTour && (
        <GuidedTour
          steps={HOMEPAGE_TOUR_STEPS}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
        />
      )}
    </PullToRefreshWrapper>
  )
}
