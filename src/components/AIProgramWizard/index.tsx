import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { useAuth } from "@/contexts/AuthContext"
import { useGoals, useDays } from "@/hooks/queries"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { AIInputForm } from "./AIInputForm"
import { GeneratingAnimation } from "./GeneratingAnimation"
import { ProgramResult } from "./ProgramResult"
import type { AIWizardState, AIWizardPhase, AIGenerateResult } from "./types"

interface AIProgramWizardProps {
  onComplete: (programId: string) => void
  onCancel: () => void
}

const initialState: AIWizardState = {
  goals: [],
  startDate: new Date().toISOString().split("T")[0],
  duration: "",
  daysOfWeek: []
}

export function AIProgramWizard({ onComplete, onCancel }: AIProgramWizardProps) {
  const { user, accessToken } = useAuth()
  const queryClient = useQueryClient()
  const [state, setState] = useState<AIWizardState>(initialState)
  const [phase, setPhase] = useState<AIWizardPhase>("input")
  const [result, setResult] = useState<AIGenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Use React Query for reference data (cached)
  const { data: goalsData = [], isLoading: goalsLoading } = useGoals()
  const { data: daysData = [], isLoading: daysLoading } = useDays()

  const isLoading = goalsLoading || daysLoading

  const updateState = (updates: Partial<AIWizardState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }

  const handleGenerate = async () => {
    if (!user?.id || !accessToken) {
      setError("Sessie verlopen. Log opnieuw in.")
      setPhase("error")
      return
    }

    setPhase("generating")
    setError(null)

    try {
      const response = await api.programs.generate(
        {
          userId: user.id,
          goals: state.goals,
          startDate: state.startDate,
          duration: state.duration,
          daysOfWeek: state.daysOfWeek
        },
        accessToken
      )

      setResult(response)
      setPhase("result")

      // Invalidate queries so programs list shows fresh data
      queryClient.invalidateQueries({ queryKey: ["programs"] })
    } catch (err) {
      console.error("Failed to generate program:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Kon programma niet genereren. Probeer het opnieuw."
      )
      setPhase("error")
    }
  }

  const handleViewProgram = () => {
    if (result?.program.id) {
      onComplete(result.program.id)
    }
  }

  const handleCreateNew = () => {
    setState(initialState)
    setResult(null)
    setError(null)
    setPhase("input")
  }

  const handleRetry = () => {
    setError(null)
    setPhase("input")
  }

  // Error phase
  if (phase === "error") {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-2">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">Er ging iets mis</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex justify-center gap-4 pt-4">
              <Button variant="outline" onClick={onCancel}>
                Annuleren
              </Button>
              <Button onClick={handleRetry}>Opnieuw proberen</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Generating phase
  if (phase === "generating") {
    return (
      <Card>
        <CardContent className="py-4">
          <GeneratingAnimation />
        </CardContent>
      </Card>
    )
  }

  // Result phase
  if (phase === "result" && result) {
    return (
      <ProgramResult
        result={result}
        onViewProgram={handleViewProgram}
        onCreateNew={handleCreateNew}
      />
    )
  }

  // Input phase (default)
  return (
    <AIInputForm
      state={state}
      updateState={updateState}
      goalsData={goalsData}
      daysData={daysData}
      isLoading={isLoading}
      onGenerate={handleGenerate}
      onCancel={onCancel}
    />
  )
}
