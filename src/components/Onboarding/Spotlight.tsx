import { useId } from 'react'

interface SpotlightProps {
  targetRect: DOMRect | null
  padding?: number
  onBackdropClick?: () => void
}

/**
 * Spotlight overlay using an SVG with a mask to cut out the target area.
 * SVG masks are immune to overflow-x:clip on html/body and work reliably
 * across all browsers.
 */
export function Spotlight({ targetRect, padding = 8, onBackdropClick }: SpotlightProps) {
  const maskId = useId()

  const x = targetRect ? targetRect.left - padding : 0
  const y = targetRect ? targetRect.top - padding : 0
  const w = targetRect ? targetRect.width + padding * 2 : 0
  const h = targetRect ? targetRect.height + padding * 2 : 0

  return (
    <svg
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 50,
      }}
      onClick={onBackdropClick}
      aria-hidden="true"
    >
      <defs>
        <mask id={maskId}>
          {/* White = visible overlay area */}
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {/* Black = transparent cutout (the spotlight hole) */}
          {targetRect && (
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx="12"
              ry="12"
              fill="black"
            />
          )}
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.5)"
        mask={`url(#${CSS.escape(maskId)})`}
      />
    </svg>
  )
}
