import { useId } from 'react'

interface SpotlightProps {
  targetRect: DOMRect | null
  padding?: number
  onBackdropClick?: () => void
}

/**
 * Spotlight overlay using an SVG with a mask to cut out the target area.
 * The SVG is visual-only (pointer-events: none). A separate transparent div
 * handles backdrop clicks, with a cutout region that blocks click propagation
 * so tapping the highlighted element still works.
 */
export function Spotlight({ targetRect, padding = 8, onBackdropClick }: SpotlightProps) {
  const maskId = useId()

  const x = targetRect ? targetRect.left - padding : 0
  const y = targetRect ? targetRect.top - padding : 0
  const w = targetRect ? targetRect.width + padding * 2 : 0
  const h = targetRect ? targetRect.height + padding * 2 : 0

  return (
    <>
      {/* Visual overlay — pointer-events: none so it never captures clicks */}
      <svg
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 50,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
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

      {/* Click handler — transparent div that captures backdrop clicks */}
      {onBackdropClick && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          onClick={onBackdropClick}
          aria-hidden="true"
        >
          {/* Cutout region blocks click propagation to backdrop handler */}
          {targetRect && (
            <div
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: w,
                height: h,
                borderRadius: 12,
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </>
  )
}
