import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Check,
  X,
  Plus,
  Clock,
  Calendar,
  Lightbulb,
  Loader2
} from "lucide-react"
import { MethodPicker } from "./MethodPicker"
import type { ScheduleReviewProps, AIScheduleMethod } from "./types"
import type { Method } from "@/types/program"

function formatScheduleDate(dateStr: string, dayOfWeek: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dayOfWeek.slice(0, 2)
  const dayAbbrev = dayOfWeek.slice(0, 2)
  const day = date.getDate()
  const month = date.toLocaleDateString("nl-NL", { month: "short" })
  return `${dayAbbrev} ${day} ${month}`
}

function getWeekNumber(dateStr: string, startDateStr: string): number {
  const date = new Date(dateStr)
  const start = new Date(startDateStr)
  if (isNaN(date.getTime()) || isNaN(start.getTime())) return 1
  const diffTime = date.getTime() - start.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}

export function ScheduleReview({
  preview,
  editedSchedule,
  onScheduleChange,
  onConfirm,
  onBack,
  isConfirming
}: ScheduleReviewProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null)

  const { weeklySessionTime, recommendations, programSummary, availableMethods, selectedGoals } = preview

  // Sort schedule by date
  const sortedSchedule = useMemo(() => {
    return [...editedSchedule].sort((a, b) => a.date.localeCompare(b.date))
  }, [editedSchedule])

  // Get start date from first scheduled day
  const startDate = sortedSchedule.length > 0 ? sortedSchedule[0].date : ""

  // Calculate total time
  const totalSessionTime = useMemo(() => {
    return editedSchedule.reduce((sum, day) => {
      return sum + day.methods.reduce((daySum, m) => daySum + m.duration, 0)
    }, 0)
  }, [editedSchedule])

  // Handle removing a method from a day
  const handleRemoveMethod = (dayIndex: number, methodIndex: number) => {
    const newSchedule = [...editedSchedule]
    const day = newSchedule[dayIndex]
    day.methods = day.methods.filter((_, i) => i !== methodIndex)
    onScheduleChange(newSchedule)
  }

  // Handle adding a method to a day
  const handleAddMethod = (dayIndex: number) => {
    setEditingDayIndex(dayIndex)
    setPickerOpen(true)
  }

  // Handle method selection from picker
  const handleMethodSelect = (method: Method) => {
    if (editingDayIndex === null) return

    const newSchedule = [...editedSchedule]
    const day = newSchedule[editingDayIndex]

    // Add the new method
    const newMethod: AIScheduleMethod = {
      methodId: method.id,
      methodName: method.name,
      duration: method.duration
    }
    day.methods = [...day.methods, newMethod]

    onScheduleChange(newSchedule)
    setEditingDayIndex(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">Controleer je programma</h3>
        <p className="text-sm text-muted-foreground">
          Pas het schema aan voordat je het bevestigt.
        </p>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Overzicht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{sortedSchedule.length} trainingsdagen</p>
              <p className="text-xs text-muted-foreground">
                {selectedGoals.map(g => g.name).join(", ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{weeklySessionTime} minuten per week</p>
              <p className="text-xs text-muted-foreground">
                Totaal: {totalSessionTime} minuten
              </p>
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

      {/* Editable Schedule */}
      <div className="space-y-3">
        <h4 className="font-medium">Trainingsschema</h4>
        <p className="text-xs text-muted-foreground">
          Klik op X om een methode te verwijderen, of + om een methode toe te voegen.
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sortedSchedule.map((day, dayIndex) => {
            const weekNum = getWeekNumber(day.date, startDate)
            const prevWeekNum = dayIndex > 0
              ? getWeekNumber(sortedSchedule[dayIndex - 1].date, startDate)
              : 0
            const showWeekHeader = weekNum !== prevWeekNum

            // Find actual index in editedSchedule (since sortedSchedule is sorted)
            const actualIndex = editedSchedule.findIndex(d => d.date === day.date)

            return (
              <div key={day.date}>
                {showWeekHeader && (
                  <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">
                    Week {weekNum}
                  </p>
                )}
                <Card>
                  <CardContent className="py-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">
                          {formatScheduleDate(day.date, day.dayOfWeek)}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {day.methods.reduce((sum, m) => sum + m.duration, 0)} min
                        </span>
                      </div>

                      {/* Methods list */}
                      <div className="space-y-1">
                        {day.methods.map((method, methodIndex) => (
                          <div
                            key={`${method.methodId}-${methodIndex}`}
                            className="flex items-center justify-between p-2 rounded bg-muted/50"
                          >
                            <span className="text-sm">
                              {method.methodName} ({method.duration} min)
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveMethod(actualIndex, methodIndex)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Add method button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleAddMethod(actualIndex)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Methode toevoegen
                      </Button>
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
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isConfirming}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isConfirming || editedSchedule.every(d => d.methods.length === 0)}
          className="flex-1"
        >
          {isConfirming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Bezig met opslaan...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Bevestig Programma
            </>
          )}
        </Button>
      </div>

      {/* Method Picker Dialog */}
      <MethodPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        availableMethods={availableMethods}
        onSelect={handleMethodSelect}
      />
    </div>
  )
}
