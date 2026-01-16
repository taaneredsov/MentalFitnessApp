import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Clock, Calendar, Lightbulb, ArrowRight, Plus } from "lucide-react"
import type { ProgramResultProps } from "./types"

export function ProgramResult({ result, onViewProgram, onCreateNew }: ProgramResultProps) {
  const { program, aiSchedule, weeklySessionTime, recommendations, programSummary } = result

  // Sort schedule by date (chronologically)
  const sortedSchedule = [...aiSchedule].sort((a, b) => {
    return a.date.localeCompare(b.date)
  })

  // Safely parse a date string, returning null if invalid
  const parseDate = (dateStr: string | undefined | null): Date | null => {
    if (!dateStr) return null
    // Handle YYYY-MM-DD format explicitly for consistent parsing
    const parts = dateStr.split("-")
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      if (!isNaN(date.getTime())) return date
    }
    // Fallback to native parsing
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? null : date
  }

  // Get effective start date: use program.startDate or fall back to first schedule date
  const effectiveStartDate = program.startDate || (sortedSchedule.length > 0 ? sortedSchedule[0].date : "")

  // Format date for display (e.g., "Ma 20 jan")
  const formatScheduleDate = (dateStr: string, dayOfWeek: string) => {
    const date = parseDate(dateStr)
    if (!date) return dayOfWeek.slice(0, 2)  // Fallback to day abbreviation only
    const dayAbbrev = dayOfWeek.slice(0, 2)  // "Ma", "Di", etc.
    const day = date.getDate()
    const month = date.toLocaleDateString("nl-NL", { month: "short" })
    return `${dayAbbrev} ${day} ${month}`
  }

  // Format start date for display
  const formatDate = (dateStr: string | undefined | null) => {
    const date = parseDate(dateStr)
    if (!date) return "Niet beschikbaar"
    return date.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long"
    })
  }

  // Group schedule by week for better display
  const getWeekNumber = (dateStr: string, startDateStr: string) => {
    const date = parseDate(dateStr)
    const start = parseDate(startDateStr)
    if (!date || !start) return 1  // Default to week 1 if dates are invalid
    const diffTime = date.getTime() - start.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return Math.floor(diffDays / 7) + 1
  }

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-2">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold">Je programma is klaar!</h3>
        <p className="text-sm text-muted-foreground">
          We hebben een gepersonaliseerd programma voor je samengesteld.
        </p>
      </div>

      {/* Program Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Programma Overzicht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Start: {formatDate(effectiveStartDate)}</p>
              <p className="text-xs text-muted-foreground">{program.duration}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{weeklySessionTime} minuten per week</p>
              <p className="text-xs text-muted-foreground">{aiSchedule.length} trainingsdagen</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Program Summary */}
      {programSummary && (
        <Card>
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">{programSummary}</p>
          </CardContent>
        </Card>
      )}

      {/* Date-based Schedule */}
      <div className="space-y-3">
        <h4 className="font-medium">Trainingsschema</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sortedSchedule.map((day, index) => {
            const weekNum = getWeekNumber(day.date, effectiveStartDate)
            const prevWeekNum = index > 0 ? getWeekNumber(sortedSchedule[index - 1].date, effectiveStartDate) : 0
            const showWeekHeader = weekNum !== prevWeekNum

            return (
              <div key={`${day.date}-${day.dayId}`}>
                {showWeekHeader && (
                  <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">
                    Week {weekNum}
                  </p>
                )}
                <Card>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{formatScheduleDate(day.date, day.dayOfWeek)}</p>
                        <div className="mt-1 space-y-1">
                          {day.methods.map((method, methodIndex) => (
                            <p key={methodIndex} className="text-sm text-muted-foreground">
                              {method.methodName} ({method.duration} min)
                            </p>
                          ))}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {day.methods.reduce((sum, m) => sum + m.duration, 0)} min
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <h4 className="font-medium">Aanbevelingen</h4>
          </div>
          <Card>
            <CardContent className="py-3">
              <ul className="space-y-2">
                {recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <Button onClick={onViewProgram} className="flex-1">
          Bekijk Programma
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={onCreateNew} className="flex-1">
          <Plus className="mr-2 h-4 w-4" />
          Nieuw Programma
        </Button>
      </div>
    </div>
  )
}
