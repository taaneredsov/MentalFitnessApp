import { useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'

interface TourTooltipProps {
  targetRect: DOMRect | null
  content: string
  currentStep: number
  totalSteps: number
  onNext: () => void
  onSkip: () => void
  isLastStep?: boolean
}

export function TourTooltip({
  targetRect,
  content,
  currentStep,
  totalSteps,
  onNext,
  onSkip,
  isLastStep = false
}: TourTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Focus tooltip when it mounts or step changes
  useEffect(() => {
    if (tooltipRef.current) {
      tooltipRef.current.focus()
    }
  }, [currentStep])

  // Calculate position (above or below target)
  const { style, arrowPosition } = useMemo(() => {
    if (!targetRect) {
      return {
        style: {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        },
        arrowPosition: 'none' as const
      }
    }

    const tooltipHeight = 160 // Estimated tooltip height
    const margin = 12
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

    // Determine if we should show above or below
    const spaceAbove = targetRect.top
    const spaceBelow = viewportHeight - targetRect.bottom
    const showAbove = spaceBelow < tooltipHeight + margin && spaceAbove > spaceBelow

    // Calculate horizontal position (centered on target, clamped to viewport)
    const tooltipWidth = Math.min(viewportWidth - 32, 320)
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
    left = Math.max(16, Math.min(left, viewportWidth - tooltipWidth - 16))

    if (showAbove) {
      return {
        style: {
          bottom: viewportHeight - targetRect.top + margin,
          left,
          width: tooltipWidth
        },
        arrowPosition: 'bottom' as const
      }
    } else {
      return {
        style: {
          top: targetRect.bottom + margin,
          left,
          width: tooltipWidth
        },
        arrowPosition: 'top' as const
      }
    }
  }, [targetRect])

  // Calculate arrow horizontal position
  const arrowLeft = useMemo(() => {
    if (!targetRect || arrowPosition === 'none') return '50%'
    const tooltipLeft = typeof style.left === 'number' ? style.left : 0
    const targetCenter = targetRect.left + targetRect.width / 2
    const arrowOffset = targetCenter - tooltipLeft
    return `${Math.max(20, Math.min(arrowOffset, (style.width as number) - 20))}px`
  }, [targetRect, style, arrowPosition])

  return (
    <>
      {/* ARIA live region for screen readers */}
      <div role="status" aria-live="polite" className="sr-only">
        Stap {currentStep + 1} van {totalSteps}: {content}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`Rondleiding stap ${currentStep + 1} van ${totalSteps}`}
        className={`fixed z-[60] bg-background rounded-xl shadow-lg border p-4 outline-none ${
          prefersReducedMotion ? '' : 'animate-in fade-in-0 slide-in-from-bottom-2 duration-200'
        }`}
        style={{
          ...style,
          maxWidth: 'calc(100vw - 32px)'
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'Enter') {
            e.preventDefault()
            onNext()
          } else if (e.key === 'ArrowLeft' && currentStep > 0) {
            // Could implement back functionality here
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onSkip()
          }
        }}
      >
        {/* Arrow */}
        {arrowPosition !== 'none' && (
          <div
            className={`absolute w-3 h-3 bg-background border rotate-45 ${
              arrowPosition === 'top'
                ? '-top-1.5 border-l border-t'
                : '-bottom-1.5 border-r border-b'
            }`}
            style={{ left: arrowLeft, transform: 'translateX(-50%) rotate(45deg)' }}
          />
        )}

        {/* Content */}
        <p className="text-sm text-foreground mb-4 leading-relaxed">
          {content}
        </p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div
              key={index}
              className={`rounded-full transition-all duration-200 ${
                index === currentStep
                  ? 'w-2.5 h-2.5 bg-primary'
                  : 'w-2 h-2 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-2"
          >
            Overslaan
          </button>
          <Button
            onClick={onNext}
            className="min-h-[44px] min-w-[100px]"
          >
            {isLastStep ? 'Klaar' : 'Volgende'}
          </Button>
        </div>
      </div>
    </>
  )
}
