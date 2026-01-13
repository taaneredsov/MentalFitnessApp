import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Program, ProgramDetail } from "@/types/program"
import {
  getProgramStatus,
  getNextScheduledDay,
  formatNextDay
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short"
  })
}

function getProgress(program: Program): number {
  const start = new Date(program.startDate).getTime()
  const end = new Date(program.endDate).getTime()
  const now = Date.now()

  if (now <= start) return 0
  if (now >= end) return 100

  return Math.round(((now - start) / (end - start)) * 100)
}

export function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [runningProgram, setRunningProgram] = useState<ProgramDetail | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)

  const firstName = user?.name?.split(" ")[0] || "there"

  useEffect(() => {
    async function fetchRunningProgram() {
      if (!user?.id) return

      try {
        const programs = await api.programs.list(user.id)
        const running = programs.find(p => getProgramStatus(p) === "running")

        if (running) {
          const detail = await api.programs.get(running.id)
          setRunningProgram(detail)
        }
      } catch (err) {
        console.error("Failed to fetch running program:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRunningProgram()
  }, [user?.id])

  const nextDay = runningProgram
    ? getNextScheduledDay(runningProgram.dayNames)
    : null

  return (
    <div className="py-6 space-y-6">
      <section className="px-4">
        <h2 className="text-2xl font-bold mb-1">Hello, {firstName}!</h2>
        <p className="text-muted-foreground">
          Welcome to your mental fitness journey.
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
                  <span>{getProgress(runningProgram)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${getProgress(runningProgram)}%` }}
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
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium text-primary">
                  {formatNextDay(nextDay)}
                </p>

                {runningProgram.methodDetails.length > 0 && (
                  <div className="space-y-2">
                    {runningProgram.methodDetails.map(method => (
                      <div
                        key={method.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
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
                      </div>
                    ))}
                  </div>
                )}

                {runningProgram.sessionTime > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Totaal: {runningProgram.sessionTime} minuten</span>
                  </div>
                )}
              </CardContent>
            </Card>
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
            <CardTitle className="text-base">Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Access helpful resources and guides.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
