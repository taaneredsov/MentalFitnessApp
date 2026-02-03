import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'mfa_onboarding'

interface OnboardingState {
  welcomeSeen: boolean
  welcomeSeenAt: string | null
  tourCompleted: boolean
  tourCompletedAt: string | null
  tourSkippedAtStep: number | null
}

const DEFAULT_STATE: OnboardingState = {
  welcomeSeen: false,
  welcomeSeenAt: null,
  tourCompleted: false,
  tourCompletedAt: null,
  tourSkippedAtStep: null
}

function loadState(): OnboardingState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_STATE, ...JSON.parse(stored) }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_STATE
}

function saveState(state: OnboardingState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors (e.g., private browsing)
  }
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(loadState)

  // Sync state to localStorage when it changes
  useEffect(() => {
    saveState(state)
  }, [state])

  const markWelcomeSeen = useCallback(() => {
    setState(prev => ({
      ...prev,
      welcomeSeen: true,
      welcomeSeenAt: new Date().toISOString()
    }))
  }, [])

  const markTourCompleted = useCallback(() => {
    setState(prev => ({
      ...prev,
      tourCompleted: true,
      tourCompletedAt: new Date().toISOString()
    }))
  }, [])

  const markTourSkipped = useCallback((step: number) => {
    setState(prev => ({
      ...prev,
      tourCompleted: true,
      tourCompletedAt: new Date().toISOString(),
      tourSkippedAtStep: step
    }))
  }, [])

  const resetOnboarding = useCallback(() => {
    setState(DEFAULT_STATE)
  }, [])

  return {
    state,
    markWelcomeSeen,
    markTourCompleted,
    markTourSkipped,
    resetOnboarding,
    shouldShowWelcome: !state.welcomeSeen,
    shouldShowTour: !state.tourCompleted
  }
}
