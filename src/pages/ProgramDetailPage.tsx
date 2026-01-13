import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { ProgramDetail } from "@/types/program"
import { getProgramStatus } from "@/types/program"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Target,
  Loader2,
  CheckCircle2
} from "lucide-react"

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  })
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    running: "bg-green-100 text-green-700",
    planned: "bg-blue-100 text-blue-700",
    finished: "bg-gray-100 text-gray-600"
  }
  const labels = {
    running: "Actief",
    planned: "Gepland",
    finished: "Afgerond"
  }
  return (
    <span
      className={`px-3 py-1 text-sm rounded-full ${styles[status as keyof typeof styles]}`}
    >
      {labels[status as keyof typeof labels]}
    </span>
  )
}

export function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [program, setProgram] = useState<ProgramDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProgram() {
      if (!id) return

      try {
        const data = await api.programs.get(id)
        setProgram(data)
      } catch (err) {
        setError("Kon programma niet laden")
        console.error("Failed to fetch program:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProgram()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !program) {
    return (
      <div className="px-4 py-6">
        <Button variant="ghost" onClick={() => navigate("/programs")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Button>
        <p className="text-destructive mt-4">{error || "Programma niet gevonden"}</p>
      </div>
    )
  }

  const status = getProgramStatus(program)

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/programs")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-bold flex-1">Programma Details</h2>
        <StatusBadge status={status} />
      </div>

      {/* Program Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overzicht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Periode</p>
              <p className="font-medium">
                {formatDate(program.startDate)} - {formatDate(program.endDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Frequentie</p>
              <p className="font-medium">{program.frequency}x per week</p>
            </div>
          </div>

          {program.sessionTime > 0 && (
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Tijd per sessie</p>
                <p className="font-medium">{program.sessionTime} minuten</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule */}
      {program.dayNames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Schema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {program.dayNames.map(day => (
                <span
                  key={day}
                  className="px-3 py-1 text-sm rounded-full bg-primary/10 text-primary"
                >
                  {day}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals */}
      {program.goalDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Doelstellingen</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {program.goalDetails.map(goal => (
                <li key={goal.id} className="flex items-start gap-3">
                  <CheckCircle2
                    className={`h-5 w-5 mt-0.5 ${
                      goal.status === "Afgerond"
                        ? "text-green-500"
                        : "text-muted-foreground"
                    }`}
                  />
                  <div>
                    <p className="font-medium">{goal.name}</p>
                    {goal.description && (
                      <p className="text-sm text-muted-foreground">
                        {goal.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Methods */}
      {program.methodDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Methodes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {program.methodDetails.map(method => (
                <li key={method.id} className="flex items-center gap-3">
                  {method.photo && (
                    <img
                      src={method.photo}
                      alt={method.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{method.name}</p>
                    {method.duration > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {method.duration} min
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {program.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {program.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
