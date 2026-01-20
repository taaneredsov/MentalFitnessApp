# Implementation Plan: Pull-to-Refresh

## Overview

Add pull-to-refresh functionality to the HomePage using the `pulltorefreshjs` library. When users pull down on the homepage, it will invalidate React Query cache and refetch program data.

## Phase 1: Setup and Basic Implementation

Implement pull-to-refresh on the HomePage with React Query integration.

### Tasks

- [ ] Install `pulltorefreshjs` package
- [ ] Create reusable `PullToRefresh` wrapper component
- [ ] Integrate pull-to-refresh on HomePage
- [ ] Connect refresh action to React Query cache invalidation

### Technical Details

**Package Installation:**
```bash
npm install pulltorefreshjs
```

**PullToRefresh Component (`src/components/PullToRefresh.tsx`):**
```tsx
import { useEffect, useRef, ReactNode } from "react"
import PullToRefresh from "pulltorefreshjs"

interface PullToRefreshWrapperProps {
  onRefresh: () => Promise<void>
  children: ReactNode
}

export function PullToRefreshWrapper({ onRefresh, children }: PullToRefreshWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ptr = PullToRefresh.init({
      mainElement: containerRef.current!,
      onRefresh,
      instructionsPullToRefresh: "Trek naar beneden om te verversen",
      instructionsReleaseToRefresh: "Laat los om te verversen",
      instructionsRefreshing: "Verversen...",
    })

    return () => {
      ptr.destroy()
    }
  }, [onRefresh])

  return <div ref={containerRef}>{children}</div>
}
```

**HomePage Integration:**
```tsx
import { useQueryClient } from "@tanstack/react-query"

// Inside HomePage component:
const queryClient = useQueryClient()

const handleRefresh = async () => {
  await queryClient.invalidateQueries({ queryKey: ["programs"] })
  await queryClient.invalidateQueries({ queryKey: ["program"] })
}

// Wrap return content with:
<PullToRefreshWrapper onRefresh={handleRefresh}>
  {/* existing HomePage content */}
</PullToRefreshWrapper>
```

**CSS for pull-to-refresh indicator (add to index.css or global styles):**
```css
.ptr--ptr {
  box-shadow: inset 0 -3px 5px rgba(0, 0, 0, 0.1);
}

.ptr--text {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.ptr--icon {
  color: hsl(var(--primary));
}
```

## Phase 2: Polish and Accessibility

Refine the UX with better animations and accessibility support.

### Tasks

- [ ] Add reduced-motion support (respect `prefers-reduced-motion`)
- [ ] Style the loading indicator to match app theme
- [ ] Add haptic feedback on mobile (if supported)
- [ ] Test on iOS Safari and Android Chrome PWA

### Technical Details

**Reduced Motion Support:**
```tsx
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

PullToRefresh.init({
  // ... other options
  distThreshold: prefersReducedMotion ? 40 : 60,
  distMax: prefersReducedMotion ? 60 : 80,
  distReload: prefersReducedMotion ? 40 : 50,
})
```

**Haptic Feedback (optional):**
```tsx
onRefresh: async () => {
  // Trigger haptic if available
  if (navigator.vibrate) {
    navigator.vibrate(10)
  }
  await handleRefresh()
}
```

**Theme-aware styling:**
```css
.ptr--ptr {
  background: hsl(var(--background));
}

.ptr--box {
  padding: 10px;
}

.ptr--icon,
.ptr--text {
  color: hsl(var(--muted-foreground));
}

/* Loading spinner color */
.ptr--icon svg {
  fill: hsl(var(--primary));
}
```

## File Changes Summary

| File | Action |
|------|--------|
| `package.json` | Add `pulltorefreshjs` dependency |
| `src/components/PullToRefresh.tsx` | Create new component |
| `src/pages/HomePage.tsx` | Wrap content with PullToRefreshWrapper |
| `src/index.css` | Add PTR styling |
