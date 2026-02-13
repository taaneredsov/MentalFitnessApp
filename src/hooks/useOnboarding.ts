import { useState, useCallback, useEffect } from 'react'

const STORAGE_PREFIX = 'mfa_onboarding'

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

function getStorageKey(userId?: string): string {
  return userId ? `${STORAGE_PREFIX}_${userId}` : STORAGE_PREFIX
}

function loadState(userId?: string): OnboardingState {
  try {
    const stored = localStorage.getItem(getStorageKey(userId))
    if (stored) {
      return { ...DEFAULT_STATE, ...JSON.parse(stored) }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_STATE
}

function saveState(state: OnboardingState, userId?: string): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(state))
  } catch {
    // Ignore storage errors (e.g., private browsing)
  }
}

export function useOnboarding(userId?: string) {
  const [state, setState] = useState<OnboardingState>(() => loadState(userId))

  // Re-load state when userId changes (e.g., after login)
  useEffect(() => {
    setState(loadState(userId))
  }, [userId])

  // Sync state to localStorage when it changes
  useEffect(() => {
    saveState(state, userId)
  }, [state, userId])

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
