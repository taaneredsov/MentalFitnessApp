import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CheckCircle2, Clock, Calendar, Lightbulb, Home, Plus, Target, X, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useCreatePersonalGoal, useOvertuigingen } from "@/hooks/queries"
import type { ProgramResultProps } from "./types"

export function ProgramResult({ result, onViewProgram, onCreateNew }: ProgramResultProps) {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()
  const createGoalMutation = useCreatePersonalGoal()

  const { program, aiSchedule, weeklySessionTime, recommendations, programSummary } = result

  // Resolve overtuigingen names from IDs
  const { data: allOvertuigingen = [] } = useOvertuigingen()
  const programOvertuigingen = allOvertuigingen.filter(o => program.overtuigingen?.includes(o.id))

  // Personal goals state
  const [showGoalsSection, setShowGoalsSection] = useState(false)
  const [personalGoals, setPersonalGoals] = useState<string[]>([])
  const [newGoalInput, setNewGoalInput] = useState("")
  const [savingGoals, setSavingGoals] = useState(false)

  // Preload homepage data while user reviews the result
  useEffect(() => {
    // Prefetch queries that homepage needs for instant navigation
    queryClient.prefetchQuery({ queryKey: ["programs"] })
    queryClient.prefetchQuery({ queryKey: ["goals"] })
    queryClient.prefetchQuery({ queryKey: ["personal-goals"] })
    queryClient.prefetchQuery({ queryKey: ["good-habits"] })
  }, [queryClient])

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

  const handleAddGoal = () => {
    const trimmed = newGoalInput.trim()
    if (trimmed && !personalGoals.includes(trimmed)) {
      setPersonalGoals([...personalGoals, trimmed])
      setNewGoalInput("")
    }
  }

  const handleRemoveGoal = (index: number) => {
    setPersonalGoals(personalGoals.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddGoal()
    }
  }

  const handleSaveAndContinue = async () => {
    if (personalGoals.length === 0 || !accessToken) {
      onViewProgram()
      return
    }

    setSavingGoals(true)
    try {
      // Save all personal goals
      for (const goalName of personalGoals) {
        await createGoalMutation.mutateAsync({
          data: { name: goalName },
          accessToken
        })
      }
      // Invalidate to refresh the list
      queryClient.invalidateQueries({ queryKey: ["personal-goals"] })
    } catch (error) {
      console.error("Failed to save personal goals:", error)
    } finally {
      setSavingGoals(false)
      onViewProgram()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-h-[700px]">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-6 pb-2 relative">
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

        {/* Overtuigingen */}
        {programOvertuigingen.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-medium">Overtuigingen</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {programOvertuigingen.map(o => (
                <span
                  key={o.id}
                  className="px-3 py-1 text-sm rounded-full bg-amber-50 text-amber-700"
                >
                  {o.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Personal Goals Section (Optional) */}
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-500" />
              <CardTitle className="text-base">Persoonlijke Doelen</CardTitle>
              <span className="text-xs text-muted-foreground ml-auto">(optioneel)</span>
            </div>
          </CardHeader>
          <CardContent>
            {!showGoalsSection ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Maak je Mental Fitness training nog persoonlijker door eigen doelen toe te voegen.
                  Denk aan situaties waarin je je nieuwe vaardigheden wilt toepassen.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGoalsSection(true)}
                    className="flex-1"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Doelen toevoegen
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Waar wil je je nieuwe vaardigheden toepassen? Bijv. "Rustiger reageren op kritiek", "Beter slapen", "Focus behouden in vergaderingen".
                </p>

                {/* Added goals list */}
                {personalGoals.length > 0 && (
                  <div className="space-y-2">
                    {personalGoals.map((goal, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border"
                      >
                        <Target className="w-4 h-4 text-orange-500 shrink-0" />
                        <span className="text-sm flex-1">{goal}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleRemoveGoal(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new goal input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Typ een doel..."
                    value={newGoalInput}
                    onChange={(e) => setNewGoalInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddGoal}
                    disabled={!newGoalInput.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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
          <div className="space-y-2">
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

        {/* Scroll fade indicator */}
        <div className="pointer-events-none sticky bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Fixed footer with buttons */}
      <div className="border-t pt-4 mt-2">
        <div className="flex gap-3">
          <Button
            onClick={handleSaveAndContinue}
            className="flex-1"
            disabled={savingGoals}
          >
            {savingGoals ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opslaan...
              </>
            ) : (
              <>
                <Home className="mr-2 h-4 w-4" />
                {personalGoals.length > 0 ? "Opslaan en doorgaan" : "Naar mijn startpagina"}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onCreateNew} disabled={savingGoals}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuw
          </Button>
        </div>
      </div>
    </div>
  )
}
