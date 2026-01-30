import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { useProgram, useMethodUsage, useUpdateProgrammaplanning, useGoals, useDays, useUpdateProgram, useRegenerateSchedule } from "@/hooks/queries"
import { useAuth } from "@/contexts/AuthContext"
import { queryKeys } from "@/lib/query-keys"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PullToRefreshWrapper } from "@/components/PullToRefresh"
import { MilestoneProgress } from "@/components/rewards"
import { FullScheduleSection } from "@/components/FullScheduleSection"
import { SessionEditDialog } from "@/components/SessionEditDialog"
import { ProgramEditDialog } from "@/components/ProgramEditDialog"
import { getProgramStatus } from "@/types/program"
import type { Programmaplanning } from "@/types/program"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Target,
  Loader2,
  CheckCircle2,
  ChevronRight,
  History,
  Timer,
  Pencil
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
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  // State for session editing
  const [editingSession, setEditingSession] = useState<Programmaplanning | null>(null)
  // State for program editing
  const [showProgramEdit, setShowProgramEdit] = useState(false)

  // Use React Query for data (cached)
  const { data: program, isLoading: programLoading, error: programError } = useProgram(id || "")
  const { data: recentActivities = [] } = useMethodUsage(id || "", 2)
  const { data: allGoals = [] } = useGoals()
  const { data: allDays = [] } = useDays()

  // Mutation for updating session
  const updateSessionMutation = useUpdateProgrammaplanning(id || "")
  // Mutation for updating program
  const updateProgramMutation = useUpdateProgram()
  // Mutation for regenerating schedule
  const regenerateMutation = useRegenerateSchedule(id || "")

  const isLoading = programLoading
  const error = programError ? "Kon programma niet laden" : null

  const handleRefresh = async () => {
    if (id) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.program(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.methodUsage(id) })
      ])
    }
  }

  const handleSaveSession = async (planningId: string, methodIds: string[]) => {
    await updateSessionMutation.mutateAsync({
      planningId,
      data: { methods: methodIds }
    })
    setEditingSession(null)
  }

  const handleSaveProgram = async (data: { goals: string[]; daysOfWeek: string[]; notes?: string }) => {
    if (!id || !accessToken) return
    await updateProgramMutation.mutateAsync({
      id,
      data,
      accessToken
    })
    setShowProgramEdit(false)
  }

  const handleRegenerateProgram = async (data: { daysOfWeek: string[]; goals?: string[]; regenerateMethod: "ai" | "simple"; force?: boolean }) => {
    await regenerateMutation.mutateAsync(data)
    setShowProgramEdit(false)
  }

  // Calculate number of future sessions (dates after today)
  const futureSessions = program?.schedule.filter(s => {
    const sessionDate = new Date(s.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return sessionDate > today
  }).length || 0

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
    <PullToRefreshWrapper onRefresh={handleRefresh}>
      <div className="px-4 py-6 space-y-6">
        <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/programs")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold flex-1">Programma Details</h2>
          <StatusBadge status={status} />
        </div>
        {(status === "running" || status === "planned") && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowProgramEdit(true)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Bewerk programma
          </Button>
        )}
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

          {program.duration && (
            <div className="flex items-center gap-3">
              <Timer className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Duur</p>
                <p className="font-medium">{program.duration}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Frequentie</p>
              <p className="font-medium">{program.frequency}x per week</p>
            </div>
          </div>

          {(() => {
            const durations = program.methodDetails
              .map(m => m.duration)
              .filter(d => d > 0)
            if (durations.length === 0) return null
            const minDuration = Math.min(...durations)
            const maxDuration = Math.max(...durations)
            return (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Tijd per sessie</p>
                  <p className="font-medium">
                    {minDuration === maxDuration
                      ? `${minDuration} minuten`
                      : `${minDuration} - ${maxDuration} minuten`}
                  </p>
                </div>
              </div>
            )
          })()}

          {/* Milestone Progress */}
          {program.totalMethods > 0 && (
            <div className="pt-2 border-t">
              <MilestoneProgress
                completedMethods={program.completedMethods}
                totalMethods={program.totalMethods}
                milestonesAwarded={program.milestonesAwarded || []}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule */}
      {program.schedule.length > 0 && (
        <FullScheduleSection
          schedule={program.schedule}
          methodDetails={program.methodDetails}
          programId={program.id}
          startDate={program.startDate}
          isEditable={status === "running" || status === "planned"}
          onEditSession={setEditingSession}
        />
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
                <li
                  key={method.id}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate(`/methods/${method.id}`, {
                    state: { programId: program.id }
                  })}
                >
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
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recent Activities */}
      {recentActivities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              Recente Activiteiten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recentActivities.map(activity => (
                <li key={activity.id} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-green-500" />
                  <div className="flex-1">
                    <p className="font-medium">{activity.methodName || "Methode"}</p>
                    {activity.usedAt && (
                      <p className="text-sm text-muted-foreground">
                        {formatDate(activity.usedAt)}
                      </p>
                    )}
                    {activity.remark && (
                      <p className="text-sm text-muted-foreground mt-1 italic">
                        "{activity.remark}"
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

      {/* Session Edit Dialog */}
      <SessionEditDialog
        open={!!editingSession}
        onOpenChange={(open) => !open && setEditingSession(null)}
        session={editingSession}
        availableMethods={program.methodDetails}
        onSave={handleSaveSession}
        isSaving={updateSessionMutation.isPending}
      />

      {/* Program Edit Dialog */}
      <ProgramEditDialog
        open={showProgramEdit}
        onOpenChange={setShowProgramEdit}
        program={program}
        allGoals={allGoals}
        allDays={allDays}
        onSave={handleSaveProgram}
        onRegenerate={handleRegenerateProgram}
        isSaving={updateProgramMutation.isPending}
        isRegenerating={regenerateMutation.isPending}
        futureSessions={futureSessions}
      />
      </div>
    </PullToRefreshWrapper>
  )
}
