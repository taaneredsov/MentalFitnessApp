import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api-client"
import { ProgramCard } from "@/components/ProgramCard"
import type { Program, ProgramStatus } from "@/types/program"
import { getProgramStatus } from "@/types/program"
import { Loader2 } from "lucide-react"

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
  const [programs, setPrograms] = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPrograms() {
      if (!user?.id) return

      try {
        const data = await api.programs.list(user.id)
        setPrograms(data)
      } catch (err) {
        setError("Kon programma's niet laden")
        console.error("Failed to fetch programs:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPrograms()
  }, [user?.id])

  const handleProgramClick = (id: string) => {
    navigate(`/programs/${id}`)
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
      <h2 className="text-2xl font-bold">Programma's</h2>

      {!hasPrograms ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Je hebt nog geen programma's.
          </p>
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
    </div>
  )
}
