import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/AuthContext"
import { usePrograms } from "@/hooks/queries"
import { queryKeys } from "@/lib/query-keys"
import { ProgramCard } from "@/components/ProgramCard"
import { PullToRefreshWrapper } from "@/components/PullToRefresh"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { ProgramWizard } from "@/components/ProgramWizard"
import { AIProgramWizard } from "@/components/AIProgramWizard"
import type { Program, ProgramStatus } from "@/types/program"
import { getProgramStatus } from "@/types/program"
import { Loader2, Plus, Sparkles, Settings2 } from "lucide-react"

interface GroupedPrograms {
  running: Program[]
  planned: Program[]
  finished: Program[]
}

function groupPrograms(programs: Program[]): GroupedPrograms {
  const grouped: GroupedPrograms = {
    running: [],
    planned: [],
    finished: []
  }

  for (const program of programs) {
    const status = getProgramStatus(program)
    grouped[status].push(program)
  }

  return grouped
}

function ProgramSection({
  title,
  programs,
  status,
  onProgramClick
}: {
  title: string
  programs: Program[]
  status: ProgramStatus
  onProgramClick: (id: string) => void
}) {
  if (programs.length === 0) return null

  return (
    <section>
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <div className="space-y-3">
        {programs.map(program => (
          <ProgramCard
            key={program.id}
            program={program}
            status={status}
            onClick={() => onProgramClick(program.id)}
          />
        ))}
      </div>
    </section>
  )
}

export function ProgramsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showWizard, setShowWizard] = useState(false)
  const [wizardType, setWizardType] = useState<"manual" | "ai" | null>(null)

  // Use React Query for programs data (cached)
  const { data: programs = [], isLoading, error: programsError } = usePrograms(user?.id)
  const error = programsError ? "Kon programma's niet laden" : null

  const handleRefresh = async () => {
    if (user?.id) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.programs(user.id) })
    }
  }

  const handleProgramClick = (id: string) => {
    navigate(`/programs/${id}`)
  }

  const handleWizardComplete = (programId: string) => {
    setShowWizard(false)
    setWizardType(null)
    navigate(`/programs/${programId}`)
  }

  const handleDialogClose = (open: boolean) => {
    setShowWizard(open)
    if (!open) {
      setWizardType(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  const grouped = groupPrograms(programs)
  const hasPrograms =
    grouped.running.length > 0 ||
    grouped.planned.length > 0 ||
    grouped.finished.length > 0

  return (
    <PullToRefreshWrapper onRefresh={handleRefresh}>
      <div className="px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-2xl font-bold">Programma's</h2>
          <Button onClick={() => setShowWizard(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Nieuw Programma
          </Button>
        </div>

      {!hasPrograms ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Je hebt nog geen programma's.
          </p>
          <Button className="mt-4" onClick={() => setShowWizard(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Maak je eerste programma
          </Button>
        </div>
      ) : (
        <>
          <ProgramSection
            title="Actief"
            programs={grouped.running}
            status="running"
            onProgramClick={handleProgramClick}
          />
          <ProgramSection
            title="Gepland"
            programs={grouped.planned}
            status="planned"
            onProgramClick={handleProgramClick}
          />
          <ProgramSection
            title="Afgerond"
            programs={grouped.finished}
            status="finished"
            onProgramClick={handleProgramClick}
          />
        </>
      )}

      {/* New Program Wizard Dialog */}
      <Dialog open={showWizard} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nieuw Programma</DialogTitle>
            <DialogDescription>
              {!wizardType
                ? "Hoe wil je je programma samenstellen?"
                : wizardType === "ai"
                ? "Laat AI een gepersonaliseerd programma voor je maken."
                : "Maak stap voor stap je eigen programma."}
            </DialogDescription>
          </DialogHeader>

          {!wizardType ? (
            <div className="space-y-4 py-4">
              <Button
                onClick={() => setWizardType("ai")}
                className="w-full justify-start h-auto py-4 whitespace-normal text-left"
                size="lg"
              >
                <Sparkles className="mr-3 h-5 w-5 shrink-0" />
                <div className="text-left min-w-0">
                  <div className="font-semibold">AI Programma (Aanbevolen)</div>
                  <div className="text-sm font-normal opacity-80">
                    Laat AI een gepersonaliseerd schema maken op basis van je doelen
                  </div>
                </div>
              </Button>
              <Button
                onClick={() => setWizardType("manual")}
                variant="outline"
                className="w-full justify-start h-auto py-4 whitespace-normal text-left"
              >
                <Settings2 className="mr-3 h-5 w-5 shrink-0" />
                <div className="text-left min-w-0">
                  <div className="font-semibold">Handmatig Samenstellen</div>
                  <div className="text-sm font-normal opacity-80">
                    Stel zelf je programma samen stap voor stap
                  </div>
                </div>
              </Button>
            </div>
          ) : wizardType === "ai" ? (
            <AIProgramWizard
              onComplete={handleWizardComplete}
              onCancel={() => setWizardType(null)}
            />
          ) : (
            <ProgramWizard
              mode="create"
              onComplete={handleWizardComplete}
              onCancel={() => setWizardType(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefreshWrapper>
  )
}
