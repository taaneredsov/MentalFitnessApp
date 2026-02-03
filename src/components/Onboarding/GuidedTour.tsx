import { useState, useEffect, useCallback, useMemo } from 'react'
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
 * Scrolls an element into view and returns a promise that resolves when done
 */
function scrollIntoViewAsync(element: Element): Promise<void> {
  return new Promise((resolve) => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })

    // Wait for scroll to complete (approximate)
    const checkScroll = () => {
      // Give it some time to settle
      setTimeout(resolve, 300)
    }

    // Use scrollend event if available, otherwise timeout
    if ('onscrollend' in window) {
      window.addEventListener('scrollend', checkScroll, { once: true })
      // Fallback timeout in case scrollend doesn't fire
      setTimeout(resolve, 1000)
    } else {
      setTimeout(resolve, 500)
    }
  })
}

export function GuidedTour({ steps, onComplete, onSkip }: GuidedTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [isScrolling, setIsScrolling] = useState(false)

  // Filter out optional steps that don't have visible elements
  const activeSteps = useMemo(() => {
    return steps.filter(step => {
      const element = document.querySelector(step.targetSelector)
      if (!element) return !step.optional // Required steps without elements should still show (error case)
      return true
    })
  }, [steps])

  const currentStep = activeSteps[currentStepIndex]
  const isLastStep = currentStepIndex === activeSteps.length - 1

  // Update target rect when step changes
  const updateTargetRect = useCallback(async () => {
    if (!currentStep) return

    const element = document.querySelector(currentStep.targetSelector)
    if (!element) {
      setTargetRect(null)
      return
    }

    // Check if element is in viewport
    const rect = element.getBoundingClientRect()
    const isInViewport =
      rect.top >= 0 &&
      rect.bottom <= window.innerHeight

    if (!isInViewport) {
      setIsScrolling(true)
      await scrollIntoViewAsync(element)
      setIsScrolling(false)
    }

    // Get fresh rect after potential scroll
    setTargetRect(element.getBoundingClientRect())
  }, [currentStep])

  // Update rect on step change
  useEffect(() => {
    updateTargetRect()
  }, [updateTargetRect])

  // Update rect on resize/scroll
  useEffect(() => {
    const handleUpdate = () => {
      if (currentStep) {
        const element = document.querySelector(currentStep.targetSelector)
        if (element) {
          setTargetRect(element.getBoundingClientRect())
        }
      }
    }

    // Debounced update
    let timeoutId: ReturnType<typeof setTimeout>
    const debouncedUpdate = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(handleUpdate, 100)
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
      setCurrentStepIndex(prev => prev + 1)
    }
  }, [isLastStep, onComplete])

  const handleSkip = useCallback(() => {
    onSkip(currentStepIndex)
  }, [currentStepIndex, onSkip])

  const handleBackdropClick = useCallback(() => {
    // Don't dismiss on backdrop click - just advance to next step
    // This prevents accidental dismissal
    handleNext()
  }, [handleNext])

  // Don't render anything if no steps or still scrolling
  if (activeSteps.length === 0) {
    onComplete()
    return null
  }

  if (isScrolling) {
    // Show just the spotlight during scroll
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
        currentStep={currentStepIndex}
        totalSteps={activeSteps.length}
        onNext={handleNext}
        onSkip={handleSkip}
        isLastStep={isLastStep}
      />
    </>,
    document.body
  )
}
