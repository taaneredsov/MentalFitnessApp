import { Card, CardContent } from "@/components/ui/card"
import type { Program, ProgramStatus } from "@/types/program"
import { Calendar, Clock, Target } from "lucide-react"

interface ProgramCardProps {
  program: Program
  status: ProgramStatus
  onClick: () => void
}

function getStatusBadge(status: ProgramStatus) {
  switch (status) {
    case "running":
      return (
        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
          Actief
        </span>
      )
    case "planned":
      return (
        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
          Gepland
        </span>
      )
    case "finished":
      return (
        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
          Afgerond
        </span>
      )
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short"
  })
}

export function ProgramCard({ program, status, onClick }: ProgramCardProps) {
  // Calculate progress from totalMethods and completedMethods (method-based tracking)
  const progress = status === "running" && program.totalMethods && program.totalMethods > 0
    ? Math.min(100, Math.round((program.completedMethods || 0) / program.totalMethods * 100))
    : null

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow py-3"
      onClick={onClick}
    >
      <CardContent>
        {program.name && (
          <h3 className="font-semibold mb-2">{program.name}</h3>
        )}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {formatDate(program.startDate)} - {formatDate(program.endDate)}
            </span>
          </div>
          {getStatusBadge(status)}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            <span>{program.frequency}x per week</span>
          </div>
          {(() => {
            // methodDetails may not be present in list view
            const methodDetails = (program as unknown as Record<string, unknown>).methodDetails as Array<Record<string, unknown>> | undefined
            if (!methodDetails || methodDetails.length === 0) return null
            const durations = methodDetails
              .map((m) => m.duration as number)
              .filter((d: number) => d > 0)
            if (durations.length === 0) return null
            const minDuration = Math.min(...durations)
            const maxDuration = Math.max(...durations)
            return (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>
                  {minDuration === maxDuration
                    ? `${minDuration} min`
                    : `${minDuration}-${maxDuration} min`}
                </span>
              </div>
            )
          })()}
        </div>

        {progress !== null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Voortgang</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
