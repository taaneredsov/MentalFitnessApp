import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Spotlight } from './Spotlight'
import { TourTooltip } from './TourTooltip'
import type { TourStep } from './tourSteps'

interface GuidedTourProps {
  steps: TourStep[]
  onComplete: () => void
  onSkip: (step: number) => void
}

/**
 * Scrolls an element into the center of the viewport and waits for completion.
 */
function scrollIntoViewAsync(element: Element): Promise<void> {
  return new Promise((resolve) => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })

    if ('onscrollend' in window) {
      window.addEventListener('scrollend', () => setTimeout(resolve, 100), { once: true })
      setTimeout(resolve, 1000) // fallback
    } else {
      setTimeout(resolve, 600)
    }
  })
}

/**
 * Check if element is fully visible with some margin.
 */
function isFullyVisible(rect: DOMRect): boolean {
  const margin = 20
  return (
    rect.top >= margin &&
    rect.bottom <= window.innerHeight - margin
  )
}

export function GuidedTour({ steps, onComplete, onSkip }: GuidedTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [isScrolling, setIsScrolling] = useState(false)

  // Find the current step, skipping optional steps whose elements don't exist.
  // This is evaluated on every render so it picks up elements that appear after data loads.
  const findNextValidStep = useCallback((fromIndex: number): { step: TourStep; index: number } | null => {
    for (let i = fromIndex; i < steps.length; i++) {
      const el = document.querySelector(steps[i].targetSelector)
      if (el) return { step: steps[i], index: i }
      if (!steps[i].optional) return { step: steps[i], index: i } // required but missing — show anyway
    }
    return null
  }, [steps])

  const current = findNextValidStep(currentStepIndex)
  const currentStep = current?.step ?? null

  // Count total visible steps for progress dots
  const totalVisibleSteps = steps.filter(s => {
    const el = document.querySelector(s.targetSelector)
    return el || !s.optional
  }).length

  // Which visible step are we on (for progress dots)?
  let visibleStepNumber = 0
  for (let i = 0; i <= (current?.index ?? 0) && i < steps.length; i++) {
    const el = document.querySelector(steps[i].targetSelector)
    if (el || !steps[i].optional) visibleStepNumber++
  }

  const isLastStep = !current || !findNextValidStep((current?.index ?? steps.length - 1) + 1)

  // Scroll to target and measure its rect
  const updateTargetRect = useCallback(async () => {
    if (!currentStep) return

    // Poll for element to appear (handles async data loading)
    let element = document.querySelector(currentStep.targetSelector)
    if (!element) {
      const maxWait = 3000
      const interval = 200
      let waited = 0
      while (!element && waited < maxWait) {
        await new Promise(r => setTimeout(r, interval))
        element = document.querySelector(currentStep.targetSelector)
        waited += interval
      }
    }

    if (!element) {
      setTargetRect(null)
      return
    }

    const rect = element.getBoundingClientRect()
    if (!isFullyVisible(rect)) {
      setIsScrolling(true)
      await scrollIntoViewAsync(element)
      setIsScrolling(false)
    }

    setTargetRect(element.getBoundingClientRect())
  }, [currentStep])

  // Update rect on step change — DOM measurement requires effect + setState
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateTargetRect()
  }, [updateTargetRect])

  // Update rect on resize/scroll
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    const debouncedUpdate = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        if (currentStep) {
          const element = document.querySelector(currentStep.targetSelector)
          if (element) {
            setTargetRect(element.getBoundingClientRect())
          }
        }
      }, 100)
    }

    window.addEventListener('resize', debouncedUpdate)
    window.addEventListener('scroll', debouncedUpdate, { passive: true })

    return () => {
      window.removeEventListener('resize', debouncedUpdate)
      window.removeEventListener('scroll', debouncedUpdate)
      clearTimeout(timeoutId)
    }
  }, [currentStep])

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete()
    } else {
      // Advance to the next index (findNextValidStep will skip missing optional steps)
      setCurrentStepIndex((current?.index ?? currentStepIndex) + 1)
    }
  }, [isLastStep, onComplete, current?.index, currentStepIndex])

  const handleSkip = useCallback(() => {
    onSkip(currentStepIndex)
  }, [currentStepIndex, onSkip])

  const handleBackdropClick = useCallback(() => {
    handleNext()
  }, [handleNext])

  if (!current) {
    onComplete()
    return null
  }

  if (isScrolling) {
    return createPortal(
      <Spotlight targetRect={null} />,
      document.body
    )
  }

  return createPortal(
    <>
      <Spotlight
        targetRect={targetRect}
        onBackdropClick={handleBackdropClick}
      />
      <TourTooltip
        targetRect={targetRect}
        content={currentStep?.content || ''}
        currentStep={visibleStepNumber - 1}
        totalSteps={totalVisibleSteps}
        onNext={handleNext}
        onSkip={handleSkip}
        isLastStep={isLastStep}
      />
    </>,
    document.body
  )
}
