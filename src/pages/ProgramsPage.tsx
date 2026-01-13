import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { usePrograms } from "@/hooks/queries"
import { ProgramCard } from "@/components/ProgramCard"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { ProgramWizard } from "@/components/ProgramWizard"
import type { Program, ProgramStatus } from "@/types/program"
import { getProgramStatus } from "@/types/program"
import { Loader2, Plus } from "lucide-react"

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
  const [showWizard, setShowWizard] = useState(false)

  // Use React Query for programs data (cached)
  const { data: programs = [], isLoading, error: programsError } = usePrograms(user?.id)
  const error = programsError ? "Kon programma's niet laden" : null

  const handleProgramClick = (id: string) => {
    navigate(`/programs/${id}`)
  }

  const handleWizardComplete = (programId: string) => {
    setShowWizard(false)
    navigate(`/programs/${programId}`)
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
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Programma's</h2>
        <Button onClick={() => setShowWizard(true)}>
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
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nieuw Programma</DialogTitle>
            <DialogDescription>
              Maak een nieuw mentaal fitnessprogramma aan.
            </DialogDescription>
          </DialogHeader>
          <ProgramWizard
            mode="create"
            onComplete={handleWizardComplete}
            onCancel={() => setShowWizard(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
