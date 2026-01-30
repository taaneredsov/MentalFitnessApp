import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronUp, Check, Calendar, CheckCircle, Circle, Pencil } from "lucide-react"
import type { Programmaplanning, Method } from "@/types/program"

interface FullScheduleSectionProps {
  schedule: Programmaplanning[]
  methodDetails: Method[]
  programId: string
  startDate: string
  isEditable?: boolean
  onEditSession?: (session: Programmaplanning) => void
}

interface ScheduleByWeek {
  weekNumber: number
  weekLabel: string
  sessions: Programmaplanning[]
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short"
  })
}

function getWeekNumber(dateStr: string, startDate: string): number {
  const date = new Date(dateStr)
  const start = new Date(startDate)
  const diffTime = date.getTime() - start.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}

export function FullScheduleSection({
  schedule,
  methodDetails,
  programId,
  startDate,
  isEditable = false,
  onEditSession
}: FullScheduleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const navigate = useNavigate()

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    // Use local date, not UTC (toISOString uses UTC which can cause date mismatch)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }, [])

  // Create method lookup map
  const methodMap = useMemo(() => {
    return new Map(methodDetails.map(m => [m.id, m]))
  }, [methodDetails])

  // Group schedule by week
  const scheduleByWeek = useMemo<ScheduleByWeek[]>(() => {
    const weeks = new Map<number, Programmaplanning[]>()

    for (const session of schedule) {
      const weekNum = getWeekNumber(session.date, startDate)
      if (!weeks.has(weekNum)) {
        weeks.set(weekNum, [])
      }
      weeks.get(weekNum)!.push(session)
    }

    return Array.from(weeks.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNumber, sessions]) => ({
        weekNumber,
        weekLabel: `Week ${weekNumber}`,
        sessions: sessions.sort((a, b) => a.date.localeCompare(b.date))
      }))
  }, [schedule, startDate])

  // Count upcoming sessions
  const upcomingSessions = useMemo(() => {
    return schedule.filter(s => s.date >= today).length
  }, [schedule, today])

  const totalSessions = schedule.length

  const handleMethodClick = (methodId: string, session: Programmaplanning) => {
    navigate(`/methods/${methodId}`, {
      state: {
        programmaplanningId: session.id,
        programId
      }
    })
  }

  return (
    <Card>
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Volledige Planning</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {upcomingSessions} van {totalSessions} sessies
            </span>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {scheduleByWeek.map(week => (
            <div key={week.weekNumber} className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">
                {week.weekLabel}
              </h4>
              <div className="space-y-2">
                {week.sessions.map(session => {
                  const isPast = session.date < today
                  const isToday = session.date === today
                  const methods = session.methodIds
                    .map(id => methodMap.get(id))
                    .filter(Boolean) as Method[]

                  // Session is complete if all methods are completed
                  const completedCount = session.completedMethodIds?.length ?? 0
                  const isSessionComplete = methods.length > 0 && completedCount >= methods.length

                  return (
                    <div
                      key={session.id}
                      className={`
                        flex items-start gap-3 p-3 rounded-lg transition-colors
                        ${isPast ? "bg-muted/30 opacity-60" : "bg-muted/50"}
                        ${isToday ? "ring-2 ring-primary ring-offset-2" : ""}
                      `}
                    >
                      {/* Completion status */}
                      <div className="mt-0.5">
                        {isSessionComplete ? (
                          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        ) : completedCount > 0 ? (
                          <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
                            <span className="text-[10px] font-medium text-green-600">
                              {completedCount}
                            </span>
                          </div>
                        ) : (
                          <div className={`w-5 h-5 rounded-full border-2 ${
                            isToday ? "border-primary" : "border-muted-foreground/30"
                          }`} />
                        )}
                      </div>

                      {/* Session content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${
                          isToday ? "text-primary" : ""
                        }`}>
                          {formatDate(session.date)}
                          {isToday && (
                            <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              Vandaag
                            </span>
                          )}
                        </p>
                        {methods.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {methods.map(m => {
                              const isMethodCompleted = session.completedMethodIds?.includes(m.id) ?? false
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => !isPast && handleMethodClick(m.id, session)}
                                  disabled={isPast}
                                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                                    isMethodCompleted
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                      : "bg-muted text-muted-foreground"
                                  } ${!isPast ? "cursor-pointer hover:bg-primary/20 hover:text-primary" : ""}`}
                                >
                                  {isMethodCompleted ? (
                                    <CheckCircle className="h-3 w-3" />
                                  ) : (
                                    <Circle className="h-3 w-3" />
                                  )}
                                  {m.name}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Duration and Edit */}
                      <div className="flex items-center gap-2">
                        {methods.length > 0 && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {methods.reduce((sum, m) => sum + (m.duration || 0), 0)} min
                          </span>
                        )}
                        {/* Edit button - only for future sessions when editable */}
                        {isEditable && !isPast && !isToday && onEditSession && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onEditSession(session)
                            }}
                            className="p-1.5 hover:bg-primary/10 rounded-md transition-colors"
                            aria-label={`Bewerk sessie van ${formatDate(session.date)}`}
                          >
                            <Pencil className="h-4 w-4 text-primary" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}
