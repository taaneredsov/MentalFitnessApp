# Implementation Plan: Enhanced Onboarding with Welcome Screen & Guided Tour

## Overview

This feature adds two components to improve first-time user experience:
1. **Welcome Screen** - shown before program creation wizard
2. **Guided Tour** - animated walkthrough after first program creation

## Phase 1: Foundation & State Management

### Task 1.1: Create Onboarding Hook
**File:** `src/hooks/useOnboarding.ts`

```typescript
interface OnboardingState {
  welcomeSeen: boolean
  welcomeSeenAt: string | null
  tourCompleted: boolean
  tourCompletedAt: string | null
  tourSkippedAtStep: number | null
}

export function useOnboarding() {
  // Read/write to localStorage key 'mfa_onboarding'
  // Provide:
  // - state: OnboardingState
  // - markWelcomeSeen()
  // - markTourCompleted()
  // - markTourSkipped(step: number)
  // - shouldShowWelcome: boolean
  // - shouldShowTour: boolean
}
```

**Acceptance:**
- [ ] Persists state to localStorage
- [ ] Correctly determines shouldShowWelcome based on state
- [ ] Correctly determines shouldShowTour based on state

---

## Phase 2: Welcome Screen

### Task 2.1: Create WelcomeScreen Component
**File:** `src/components/Onboarding/WelcomeScreen.tsx`

**Structure:**
```tsx
export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  // App logo
  // Headline: "Welkom bij je Mental Fitness reis"
  // Subheadline: "In een paar stappen maken we samen een programma dat bij jou past."
  // 3 step cards with icons (Target, Calendar, Sparkles)
  // Reassurance text
  // Time estimate
  // CTA button
}
```

**Design:**
- Use existing Card components or simple divs with borders
- Icons from lucide-react: Target, Calendar, Sparkles
- Button with primary variant
- Vertical connecting lines between steps

**Animation:**
- Logo: fade in + scale (0.95→1.0)
- Steps: stagger fade in, 100ms apart
- Use CSS animations or framer-motion if available
- Respect `prefers-reduced-motion`

**Acceptance:**
- [ ] Displays all content per spec
- [ ] Button calls onStart callback
- [ ] Animations work (and disabled with reduced motion)
- [ ] Mobile responsive (375px)

### Task 2.2: Integrate WelcomeScreen into HomePage
**File:** `src/pages/HomePage.tsx`

**Changes:**
- Import useOnboarding hook
- Before showing wizard for new users, check shouldShowWelcome
- If true, show WelcomeScreen instead of wizard
- On WelcomeScreen "Start" click:
  - Call markWelcomeSeen()
  - Proceed to show wizard

**Acceptance:**
- [ ] New user without programs sees WelcomeScreen first
- [ ] After clicking Start, wizard is shown
- [ ] WelcomeScreen not shown again on refresh

---

## Phase 3: Guided Tour Components

### Task 3.1: Create Spotlight Component
**File:** `src/components/Onboarding/Spotlight.tsx`

**Props:**
```tsx
interface SpotlightProps {
  targetRect: DOMRect | null  // Element to highlight
  padding?: number            // Extra space around element (default: 8)
  onBackdropClick?: () => void
}
```

**Implementation:**
- Fixed position overlay covering viewport
- Use SVG with mask or CSS clip-path to create cutout
- Animate clip-path when targetRect changes
- Semi-transparent backdrop (rgba(0,0,0,0.5))

**Acceptance:**
- [ ] Highlights element with crisp edges
- [ ] Smooth 300ms transition between targets
- [ ] Handles null targetRect (full overlay)
- [ ] Respects reduced motion preference

### Task 3.2: Create TourTooltip Component
**File:** `src/components/Onboarding/TourTooltip.tsx`

**Props:**
```tsx
interface TourTooltipProps {
  targetRect: DOMRect | null
  content: string
  currentStep: number
  totalSteps: number
  onNext: () => void
  onSkip: () => void
  position?: 'above' | 'below'  // Auto-calculated if not provided
}
```

**Features:**
- Auto-position based on element location (above/below)
- Arrow pointing to element
- Progress dots
- "Volgende" button (primary)
- "Overslaan" link
- Focus management (tabIndex, focus on mount)

**Acceptance:**
- [ ] Positions correctly above/below target
- [ ] Shows progress dots
- [ ] Buttons work
- [ ] Accessible (focusable, ARIA)
- [ ] Min 44px touch targets

### Task 3.3: Create GuidedTour Orchestrator
**File:** `src/components/Onboarding/GuidedTour.tsx`

**Props:**
```tsx
interface TourStep {
  targetSelector: string  // data-tour="activity" -> [data-tour="activity"]
  content: string
  optional?: boolean      // Skip if element not found
}

interface GuidedTourProps {
  steps: TourStep[]
  onComplete: () => void
  onSkip: (step: number) => void
}
```

**Implementation:**
1. Track currentStep state
2. Use ResizeObserver to track target element positions
3. Filter out optional steps where element doesn't exist
4. Handle scroll-into-view before showing step
5. Keyboard navigation (Arrow keys, Escape)
6. Render Spotlight + TourTooltip via portal

**Acceptance:**
- [ ] Steps through all visible tour steps
- [ ] Skips optional steps when element missing
- [ ] Scrolls to element if off-screen
- [ ] Keyboard navigation works
- [ ] Calls onComplete/onSkip appropriately

---

## Phase 4: Integration

### Task 4.1: Add data-tour Attributes to HomePage Elements
**File:** `src/pages/HomePage.tsx`

**Add attributes:**
```tsx
// Today's Activity Card
<Card data-tour="activity" ...>

// Score Widgets (may need to modify ScoreWidgets.tsx)
<div data-tour="scores" ...>

// Program Progress Card
<Card data-tour="progress" ...>

// Personal Goals Section
<section data-tour="goals" ...>

// Good Habits Section
<section data-tour="habits" ...>
```

**Also modify:**
- `src/components/ScoreWidgets.tsx` - add data-tour="scores"
- `src/components/PersonalGoalsSection.tsx` - add data-tour="goals"
- `src/components/GoodHabitsSection.tsx` - add data-tour="habits"

### Task 4.2: Add data-tour to Bottom Navigation
**File:** `src/components/Layout.tsx` or wherever BottomNav lives

Add `data-tour="navigation"` to the bottom navigation container.

### Task 4.3: Trigger Tour After First Program Creation
**File:** `src/components/AIProgramWizard/index.tsx`

**Changes:**
- Accept new prop: `isFirstProgram?: boolean`
- On successful program creation:
  - If isFirstProgram, navigate to homepage with state: `{ startTour: true }`

**File:** `src/pages/HomePage.tsx`

**Changes:**
- Check location.state.startTour
- If true and shouldShowTour:
  - Clear the state (replace history)
  - Start GuidedTour with defined steps
  - On complete/skip: call appropriate onboarding hook method

### Task 4.4: Define Tour Steps Configuration
**File:** `src/components/Onboarding/tourSteps.ts`

```typescript
export const HOMEPAGE_TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="activity"]',
    content: 'Dit is je belangrijkste taak voor vandaag. Tik op een oefening om te beginnen.'
  },
  {
    targetSelector: '[data-tour="scores"]',
    content: 'Hier zie je je punten en streak. Blijf actief om je score te verhogen!'
  },
  {
    targetSelector: '[data-tour="progress"]',
    content: 'Volg hier je voortgang. Tik om je volledige programma te bekijken.'
  },
  {
    targetSelector: '[data-tour="goals"]',
    content: 'Stel persoonlijke doelen om extra gemotiveerd te blijven.',
    optional: true
  },
  {
    targetSelector: '[data-tour="habits"]',
    content: 'Bouw goede gewoontes op met dagelijkse check-ins.',
    optional: true
  },
  {
    targetSelector: '[data-tour="navigation"]',
    content: 'Navigeer hier naar je programma\'s, alle methodes, of je account-instellingen.'
  }
]
```

---

## Phase 5: Polish & Accessibility

### Task 5.1: Add ARIA Live Region
Add screen reader announcements in GuidedTour.tsx:
```tsx
<div role="status" aria-live="polite" className="sr-only">
  Stap {currentStep} van {totalSteps}: {currentContent}
</div>
```

### Task 5.2: Implement Reduced Motion Support
In Spotlight.tsx and TourTooltip.tsx:
```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Disable or reduce animations if true
```

### Task 5.3: Handle Edge Cases
- Device rotation: Add resize listener to recalculate positions
- Navigate away: Clean up tour state
- Window blur: Optionally pause tour

---

## Testing Plan

### Manual Testing
1. New user flow: Login → Welcome Screen → Wizard → Homepage → Tour
2. Tour navigation: Next, Skip, Keyboard
3. Mobile viewport (375px)
4. Dark mode
5. Screen reader (VoiceOver)

### Automated Tests (Optional)
- Unit tests for useOnboarding hook
- Component tests for WelcomeScreen
- Integration test for full flow

---

## Rollout Checklist

- [ ] All components created and working
- [ ] Welcome screen shows for new users
- [ ] Tour triggers after first program
- [ ] Tour completes without errors
- [ ] Mobile responsive
- [ ] Accessibility verified
- [ ] No console errors
- [ ] Build passes

---

## Estimated Complexity

| Task | Complexity | Effort |
|------|------------|--------|
| useOnboarding hook | Low | Small |
| WelcomeScreen | Medium | Medium |
| Spotlight component | Medium | Medium |
| TourTooltip component | Medium | Medium |
| GuidedTour orchestrator | High | Large |
| Homepage integration | Medium | Medium |
| Accessibility polish | Medium | Medium |

**Total estimated effort:** Medium-Large feature
