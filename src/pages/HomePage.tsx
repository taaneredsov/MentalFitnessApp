import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { usePrograms, useProgram } from "@/hooks/queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Programmaplanning } from "@/types/program"
import {
  getProgramStatus,
  getNextScheduledDay,
  formatNextDay,
  getSessionProgress
} from "@/types/program"
import {
  Calendar,
  Clock,
  Target,
  Loader2,
  ChevronRight,
  Sparkles
} from "lucide-react"
import { InstallPrompt } from "@/components/InstallPrompt"
import { AIProgramWizard } from "@/components/AIProgramWizard"
import { FullScheduleSection } from "@/components/FullScheduleSection"

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short"
  })
}

/**
 * Find the next scheduled session from the program schedule
 * Returns today's session if available, otherwise the next upcoming session
 */
function getNextScheduledSession(schedule: Programmaplanning[]): Programmaplanning | null {
  if (!schedule?.length) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split("T")[0]

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
  const [showOnboarding, setShowOnboarding] = useState(false)

  const firstName = user?.name?.split(" ")[0] || "there"

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

  // Auto-show onboarding for first-time users
  const shouldShowOnboarding = showOnboarding || (hasNoPrograms && !programsLoading)

  const handleOnboardingComplete = (programId: string) => {
    setShowOnboarding(false)
    navigate(`/programs/${programId}`)
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

  // Show onboarding wizard for first-time users
  if (shouldShowOnboarding) {
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
    <div className="py-6 space-y-6">
      <section className="px-4">
        <h2 className="text-2xl font-bold mb-1">Hello, {firstName}!</h2>
        <p className="text-muted-foreground">
          Welkom bij je persoonlijke mentale fitness-coach.
        </p>
      </section>

      <InstallPrompt />

      {isLoading ? (
        <div className="flex items-center justify-center h-32 px-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : runningProgram ? (
        <section className="grid gap-4 px-4">
          {/* Current Program Card */}
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/programs/${runningProgram.id}`)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Huidig Programma</CardTitle>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              {runningProgram.name && (
                <p className="text-sm text-muted-foreground mt-1">
                  {runningProgram.name}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatDate(runningProgram.startDate)} -{" "}
                    {formatDate(runningProgram.endDate)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  <span>{runningProgram.frequency}x per week</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Voortgang</span>
                  <span>{getSessionProgress(runningProgram)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${getSessionProgress(runningProgram)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Activity Card */}
          {nextDay && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">
                    {nextDay.isToday
                      ? "Activiteit van Vandaag"
                      : "Volgende Activiteit"}
                  </CardTitle>
                </div>
                {runningProgram.name && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {runningProgram.name}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium text-primary">
                  {formatNextDay(nextDay)}
                </p>

                {todaysMethods.length > 0 && (
                  <div className="space-y-2">
                    {todaysMethods.map(method => (
                      <div
                        key={method.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/methods/${method.id}`, {
                            state: {
                              programmaplanningId: nextSession?.id,
                              programId: runningProgram.id  // Fallback for backward compatibility
                            }
                          })
                        }}
                      >
                        {method.photo && (
                          <img
                            src={method.photo}
                            alt={method.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {method.name}
                          </p>
                          {method.duration > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {method.duration} min
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
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

          {/* Full Schedule View */}
          {runningProgram.schedule.length > 0 && (
            <FullScheduleSection
              schedule={runningProgram.schedule}
              methodDetails={runningProgram.methodDetails}
              programId={runningProgram.id}
              startDate={runningProgram.startDate}
            />
          )}
        </section>
      ) : (
        <section className="grid gap-4 px-4">
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

      <section className="grid gap-4 px-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hulp & Informatie</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Veelgestelde vragen en handleidingen.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
