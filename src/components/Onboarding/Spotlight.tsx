import { useMemo } from 'react'

interface SpotlightProps {
  targetRect: DOMRect | null
  padding?: number
  onBackdropClick?: () => void
}

export function Spotlight({ targetRect, padding = 8, onBackdropClick }: SpotlightProps) {
  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Calculate the clip-path polygon that creates a hole for the target
  const clipPath = useMemo(() => {
    if (!targetRect) {
      // Full overlay, no hole
      return 'none'
    }

    const x1 = Math.max(0, targetRect.left - padding)
    const y1 = Math.max(0, targetRect.top - padding)
    const x2 = Math.min(window.innerWidth, targetRect.right + padding)
    const y2 = Math.min(window.innerHeight, targetRect.bottom + padding)

    // Create a polygon with a rectangular hole
    // The path goes around the viewport, then cuts out the target area
    return `polygon(
      0% 0%,
      0% 100%,
      ${x1}px 100%,
      ${x1}px ${y1}px,
      ${x2}px ${y1}px,
      ${x2}px ${y2}px,
      ${x1}px ${y2}px,
      ${x1}px 100%,
      100% 100%,
      100% 0%
    )`
  }, [targetRect, padding])

  return (
    <div
      className={`fixed inset-0 bg-black/50 z-50 ${
        prefersReducedMotion ? '' : 'transition-[clip-path] duration-300 ease-out'
      }`}
      style={{
        clipPath: clipPath === 'none' ? undefined : clipPath
      }}
      onClick={onBackdropClick}
      aria-hidden="true"
    />
  )
}
