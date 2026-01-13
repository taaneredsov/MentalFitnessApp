import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Clock, Calendar, Lightbulb, ArrowRight, Plus } from "lucide-react"
import { DAY_ORDER, type ProgramResultProps } from "./types"

export function ProgramResult({ result, onViewProgram, onCreateNew }: ProgramResultProps) {
  const { program, aiSchedule, weeklySessionTime, recommendations } = result

  // Sort schedule by day order
  const sortedSchedule = [...aiSchedule].sort((a, b) => {
    return DAY_ORDER.indexOf(a.dayName) - DAY_ORDER.indexOf(b.dayName)
  })

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long"
    })
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
              <p className="text-sm font-medium">Start: {formatDate(program.startDate)}</p>
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

      {/* Weekly Schedule */}
      <div className="space-y-3">
        <h4 className="font-medium">Weekschema</h4>
        <div className="space-y-2">
          {sortedSchedule.map((day) => (
            <Card key={day.dayId}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{day.dayName}</p>
                    <div className="mt-1 space-y-1">
                      {day.methods
                        .sort((a, b) => a.order - b.order)
                        .map((method, index) => (
                          <p key={index} className="text-sm text-muted-foreground">
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
          ))}
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
