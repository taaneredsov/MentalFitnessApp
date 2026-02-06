import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { useAuth } from "@/contexts/AuthContext"
import { useGoals, useDays, useMethods } from "@/hooks/queries"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { STEPS, type WizardState } from "./types"
import { BasicInfoStep } from "./BasicInfoStep"
import { GoalsStep } from "./GoalsStep"
import { ScheduleStep } from "./ScheduleStep"
import { MethodsStep } from "./MethodsStep"
import { OvertuigingenStep } from "./OvertuigingenStep"
import { ConfirmationStep } from "./ConfirmationStep"

interface ProgramWizardProps {
  mode: "onboarding" | "create"  // Reserved for potential future use
  onComplete: (programId: string) => void
  onCancel?: () => void
}

// mode is available for future differentiation between onboarding and create flows

const initialState: WizardState = {
  step: 0,
  startDate: new Date().toISOString().split("T")[0],
  duration: "",
  goals: [],
  overtuigingen: [],
  daysOfWeek: [],
  methods: [],
  notes: "",
  isPolling: false,
  isSaving: false
}

export function ProgramWizard({ onComplete, onCancel }: ProgramWizardProps) {
  const { user, accessToken } = useAuth()
  const queryClient = useQueryClient()
  const [state, setState] = useState<WizardState>(initialState)
  const [error, setError] = useState<string | null>(null)

  // Use React Query for reference data (cached)
  const { data: goalsData = [], isLoading: goalsLoading } = useGoals()
  const { data: daysData = [], isLoading: daysLoading } = useDays()
  const { data: methodsData = [], isLoading: methodsLoading } = useMethods()

  const isLoading = goalsLoading || daysLoading || methodsLoading

  const updateState = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }

  const goNext = () => {
    if (state.step < STEPS.length - 1) {
      updateState({ step: state.step + 1 })
    }
  }

  const goBack = () => {
    if (state.step > 0) {
      updateState({ step: state.step - 1 })
    } else if (onCancel) {
      onCancel()
    }
  }

  // Poll for methods after goals are updated
  const pollForMethods = async (programId: string, maxAttempts = 10) => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const methods = await api.programs.getMethods(programId, accessToken!)
        if (methods.length > 0) {
          return methods
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
      await new Promise((r) => setTimeout(r, 3000))
    }
    return []
  }

  // Step 0 completion: Create program with basic info
  const handleBasicInfoComplete = async () => {
    if (!user?.id || !accessToken) {
      setError("Sessie verlopen. Log opnieuw in.")
      return
    }

    updateState({ isSaving: true })

    try {
      // Create program with just basic info
      const program = await api.programs.create(
        {
          userId: user.id,
          startDate: state.startDate,
          duration: state.duration
        },
        accessToken
      )

      updateState({ programId: program.id, isSaving: false, step: state.step + 1 })
    } catch (err) {
      console.error("Failed to create program:", err)
      updateState({ isSaving: false })
      setError("Kon programma niet aanmaken")
    }
  }

  // Step 1 completion: Update program with goals (triggers Airtable automation)
  const handleGoalsComplete = async () => {
    if (!user?.id || !accessToken || !state.programId) {
      setError("Sessie verlopen. Log opnieuw in.")
      return
    }

    updateState({ isSaving: true })

    try {
      // Update program with goals - this triggers the automation
      await api.programs.update(
        state.programId,
        { goals: state.goals.length > 0 ? state.goals : [] },
        accessToken
      )

      updateState({ isSaving: false, step: state.step + 1 })
    } catch (err) {
      console.error("Failed to update goals:", err)
      updateState({ isSaving: false })
      setError("Kon doelstellingen niet opslaan")
    }
  }

  // Step 2 completion: Update program with schedule, then poll for methods
  const handleScheduleComplete = async () => {
    if (!user?.id || !accessToken || !state.programId) {
      setError("Sessie verlopen. Log opnieuw in.")
      return
    }

    updateState({ isPolling: true, step: state.step + 1 })

    try {
      // Update program with daysOfWeek
      await api.programs.update(
        state.programId,
        { daysOfWeek: state.daysOfWeek },
        accessToken
      )

      // Poll for suggested methods (automation should have triggered after goals update)
      const suggestedMethods = await pollForMethods(state.programId)

      updateState({
        methods: suggestedMethods,
        isPolling: false
      })
    } catch (err) {
      console.error("Failed to update schedule:", err)
      updateState({ isPolling: false })
      setError("Kon schema niet opslaan")
    }
  }

  // Final save with methods and notes
  const handleSave = async () => {
    if (!user?.id || !accessToken || !state.programId) {
      setError("Sessie verlopen. Log opnieuw in.")
      return
    }

    updateState({ isSaving: true })

    try {
      // Update program with methods, overtuigingen, and notes
      await api.programs.update(
        state.programId,
        {
          methods: state.methods.length > 0 ? state.methods : undefined,
          overtuigingen: state.overtuigingen.length > 0 ? state.overtuigingen : undefined,
          notes: state.notes || undefined
        },
        accessToken
      )

      // Invalidate queries so homepage and other pages show fresh data
      queryClient.invalidateQueries({ queryKey: ["programs"] })
      queryClient.invalidateQueries({ queryKey: ["program", state.programId] })

      onComplete(state.programId)
    } catch (err) {
      console.error("Failed to save program:", err)
      updateState({ isSaving: false })
      setError("Kon programma niet opslaan")
    }
  }

  const handleRetry = () => {
    setError(null)
    // React Query will automatically retry/refetch when component re-renders
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="py-8 text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={handleRetry}>
              Opnieuw proberen
            </Button>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Annuleren
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const stepProps = {
    state,
    updateState,
    goalsData,
    daysData,
    methodsData,
    onNext: goNext,
    onBack: goBack,
    isLoading
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-220px)]">
      {/* Step indicator - compact for mobile */}
      <div className="flex justify-center items-center gap-1">
        {STEPS.map((_, index) => (
          <div
            key={index}
            className="flex items-center"
          >
            {index > 0 && (
              <div
                className={`w-4 sm:w-6 h-0.5 ${
                  index <= state.step ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium shrink-0 ${
                index === state.step
                  ? "bg-primary text-primary-foreground"
                  : index < state.step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {index + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Step title */}
      <div className="text-center mt-4">
        <h2 className="text-xl font-semibold">{STEPS[state.step].title}</h2>
        <p className="text-sm text-muted-foreground">
          {STEPS[state.step].description}
        </p>
      </div>

      {/* Step content - grows to fill available space */}
      <div className="flex-1 mt-4">
        {state.step === 0 && (
          <BasicInfoStep
            {...stepProps}
            onNext={handleBasicInfoComplete}
          />
        )}
        {state.step === 1 && (
          <GoalsStep
            {...stepProps}
            onNext={handleGoalsComplete}
          />
        )}
        {state.step === 2 && (
          <OvertuigingenStep
            {...stepProps}
          />
        )}
        {state.step === 3 && (
          <ScheduleStep
            {...stepProps}
            onNext={handleScheduleComplete}
          />
        )}
        {state.step === 4 && <MethodsStep {...stepProps} />}
        {state.step === 5 && (
          <ConfirmationStep
            {...stepProps}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  )
}
