# Action Required: Enhanced Onboarding with Welcome Screen & Guided Tour

## Status: ✅ COMPLETED (2026-02-03)

## Implementation Tasks

### Phase 1: Foundation
- [x] Create `useOnboarding` hook for state management

### Phase 2: Welcome Screen
- [x] Create `WelcomeScreen` component
- [x] Integrate WelcomeScreen into HomePage flow
- [x] Button text: "Maak mijn programma"

### Phase 3: Guided Tour Components
- [x] Create `Spotlight` component (clip-path overlay)
- [x] Create `TourTooltip` component
- [x] Create `GuidedTour` orchestrator

### Phase 4: Integration
- [x] Add `data-tour` attributes to HomePage elements
- [x] Add `data-tour` to bottom navigation
- [x] Trigger tour after first program creation
- [x] Define tour steps configuration
- [x] Hide install prompt during tour (avoid spotlight issues)

### Phase 5: Polish
- [x] Add ARIA live region for screen readers
- [x] Implement reduced motion support
- [x] Add `onboardingInProgress` state to prevent auto-redirect
- [x] Dismiss install prompt when tour starts

### Phase 6: Program Result Enhancements
- [x] Stay on result screen after program creation (no auto-redirect)
- [x] Add optional Personal Goals section
- [x] Personal goals guidance explains Mental Fitness reinforcement
- [x] Preload homepage data for snappy navigation
- [x] Button: "Naar mijn startpagina" (or "Opslaan en doorgaan" if goals added)

### Phase 7: Wizard UX Improvements
- [x] Fixed height containers for all wizard steps
- [x] Buttons always visible without scrolling
- [x] Scroll fade indicators to hint at more content
- [x] Clearer instruction text in ScheduleReview

### Phase 8: Layout Fixes
- [x] ScoreWidgets: CSS grid for equal column widths
- [x] BottomNav: Fixed text truncation
- [x] Install prompt text updated: "TIP: Voeg eerst de app toe..."

## Files Created
- `src/hooks/useOnboarding.ts`
- `src/components/Onboarding/WelcomeScreen.tsx`
- `src/components/Onboarding/Spotlight.tsx`
- `src/components/Onboarding/TourTooltip.tsx`
- `src/components/Onboarding/GuidedTour.tsx`
- `src/components/Onboarding/tourSteps.ts`
- `src/components/Onboarding/index.ts`

## Files Modified
- `src/pages/HomePage.tsx` - Onboarding integration, tour trigger, install prompt handling
- `src/pages/MagicLinkPage.tsx` - Added prominent install prompt
- `src/components/BottomNav.tsx` - Added data-tour attribute, fixed text truncation
- `src/components/InstallPrompt.tsx` - Added variant prop, updated text
- `src/components/ScoreWidgets.tsx` - Changed to CSS grid layout
- `src/components/AIProgramWizard/AIInputForm.tsx` - Fixed height, sticky buttons
- `src/components/AIProgramWizard/ScheduleReview.tsx` - Fixed height, clearer text
- `src/components/AIProgramWizard/ProgramResult.tsx` - Personal goals section, preloading

## Testing Completed
- [x] New user flow: Login → Welcome Screen → Wizard → Personal Goals → Homepage → Tour
- [x] Tour navigation: Next, Skip
- [x] Mobile viewport testing
- [x] Tour only shows once (localStorage)
- [x] Welcome screen only shows once (localStorage)
- [x] Install prompt hidden during tour
- [x] Personal goals save correctly
