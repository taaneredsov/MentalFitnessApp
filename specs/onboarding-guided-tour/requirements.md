# Requirements: Enhanced Onboarding with Welcome Screen & Guided Tour

## Summary

Improve the first-time user experience by adding:
1. A **Welcome Screen** before the program creation wizard that explains what will happen
2. An **Animated Guided Tour** of the homepage after program creation that explains the structure

This creates a "take users by the hand" experience that reduces confusion and improves retention.

## User Stories

### As a new user
- I want to understand what will happen before I start creating my program
- So I feel confident and know what to expect

### As a user who just created my first program
- I want to understand the homepage structure and where to find things
- So I can start using the app effectively

---

## Feature 1: Welcome Screen

### When to Show
- Triggered when a new user (with no programs) lands on HomePage
- Shown BEFORE the program creation wizard
- Only shown once per user (tracked in localStorage)

### Content Structure

```
┌─────────────────────────────────────┐
│                                     │
│         [App Logo/Icon]             │
│                                     │
│   Welkom bij je Mental Fitness reis │
│                                     │
│   In een paar stappen maken we      │
│   samen een programma dat bij       │
│   jou past.                         │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🎯  Stap 1                  │    │
│  │     Vertel ons wat je wilt  │    │
│  │     bereiken                │    │
│  └─────────────────────────────┘    │
│              │                      │
│  ┌─────────────────────────────┐    │
│  │ 📅  Stap 2                  │    │
│  │     Kies wanneer het jou    │    │
│  │     uitkomt                 │    │
│  └─────────────────────────────┘    │
│              │                      │
│  ┌─────────────────────────────┐    │
│  │ ✨  Stap 3                  │    │
│  │     Krijg je persoonlijke   │    │
│  │     plan                    │    │
│  └─────────────────────────────┘    │
│                                     │
│  Geen zorgen - je kunt je keuzes    │
│  later altijd aanpassen.            │
│                                     │
│  Dit duurt ongeveer 2 minuten.      │
│                                     │
│        [Start mijn programma]       │
│                                     │
└─────────────────────────────────────┘
```

### Design Requirements
- Full-screen overlay or dedicated page
- Clean, simple design with app branding
- Vertical progress indicator connecting the 3 steps
- Clear CTA button with primary styling
- Subtle entrance animation (logo fade + scale, staggered step reveals)
- Keep total animation under 800ms

---

## Feature 2: Guided Homepage Tour

### When to Show
- Triggered after user completes their first program creation
- User is redirected to HomePage, then tour starts automatically
- Only shown once per user (tracked in localStorage)

### Tour Steps (5-6 steps depending on visible sections)

| Step | Target | Tooltip Content |
|------|--------|-----------------|
| 1 | Today's Activity Card | "Dit is je belangrijkste taak voor vandaag. Tik op een oefening om te beginnen." |
| 2 | Score Widgets | "Hier zie je je punten en streak. Blijf actief om je score te verhogen!" |
| 3 | Program Progress Card | "Volg hier je voortgang. Tik om je volledige programma te bekijken." |
| 4 | Personal Goals Section | "Stel persoonlijke doelen om extra gemotiveerd te blijven." *(Skip if not visible)* |
| 5 | Good Habits Section | "Bouw goede gewoontes op met dagelijkse check-ins." *(Skip if not visible)* |
| 6 | Bottom Navigation | "Navigeer hier naar je programma's, alle methodes, of je account-instellingen." |

### Conditional Step Handling
- If PersonalGoalsSection is not rendered: Skip step 4, adjust numbering
- If GoodHabitsSection is not rendered: Skip step 5, adjust numbering
- Show dynamic progress dots (e.g., 4 dots if 2 sections missing)

### Tour UI Components

#### Spotlight Overlay
- Semi-transparent backdrop (`bg-black/50`)
- Use `clip-path` for crisp spotlight edges (not box-shadow)
- Smooth 300ms transition when moving between elements

#### Tooltip Box
- Width: `calc(100vw - 32px)` with `max-width: 320px`
- Background: `bg-background` (adapts to dark mode)
- Shadow: `shadow-lg` for elevation
- Content:
  - Step text (2-3 lines max)
  - Visual progress dots (not "1/5" text)
  - "Volgende" button (primary, min 44x44px touch target)
  - "Overslaan" link (min 44x44px touch target with padding)

#### Tooltip Positioning
| Element Position | Tooltip Position | Arrow Direction |
|-----------------|------------------|-----------------|
| Top of viewport | Below element | Arrow points up |
| Bottom of viewport | Above element | Arrow points down |
| Center | Prefer below | Arrow points up |

#### Progress Indicator
```
[ ●   ○   ○   ○   ○ ]
  ^
  Current step (filled, slightly larger)
```

### Animation Timing
| Animation | Duration | Easing |
|-----------|----------|--------|
| Spotlight transition | 300ms | ease-out |
| Tooltip entrance | 200ms | ease-out |
| Tooltip exit | 150ms | ease-in |
| Progress dot update | 200ms | ease-in-out |

Total step transition under 500ms.

### Interaction Model

| Action | Behavior |
|--------|----------|
| Tap "Volgende" button | Advance to next step |
| Tap highlighted element | Advance to next step |
| Tap backdrop | Show subtle prompt (do NOT dismiss) |
| Swipe left on tooltip | Advance to next step |
| Swipe right on tooltip | Go back to previous step |
| Tap "Overslaan" | Dismiss tour entirely |

### Keyboard Navigation (Accessibility)
| Key | Action |
|-----|--------|
| Tab | Move focus to "Volgende" button |
| Enter/Space | Activate focused button |
| Escape | Open "Skip tour?" confirmation |
| Arrow Right | Next step |
| Arrow Left | Previous step |

---

## Accessibility Requirements

### Focus Management
- Programmatically focus tooltip when step changes
- Tooltip container needs `tabIndex={-1}`

### ARIA Announcements
```tsx
<div role="status" aria-live="polite" className="sr-only">
  {`Stap ${currentStep} van ${totalSteps}: ${stepDescription}`}
</div>
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  .spotlight-overlay,
  .tour-tooltip {
    transition: none;
  }
}
```

### Touch Targets
All interactive elements minimum 44x44px

### Color Contrast
- Verify 4.5:1 contrast for all text
- Test in both light and dark mode

---

## Scroll Handling

If a target element is not in viewport:
1. Smooth scroll to bring element into view
2. Wait for scroll to complete
3. Then show spotlight and tooltip

```tsx
await scrollIntoViewPromise(element, {
  behavior: 'smooth',
  block: 'center'
});
```

---

## State Management

### localStorage Structure
```javascript
{
  'mfa_onboarding': {
    welcomeSeen: true,
    welcomeSeenAt: '2024-01-15T10:30:00Z',
    tourCompleted: true,
    tourCompletedAt: '2024-01-15T10:32:00Z',
    tourSkippedAtStep: null // or step number if skipped
  }
}
```

### Flow Logic
```
User lands on HomePage
  └── hasPrograms?
        ├── YES → Show normal homepage
        │         └── tourCompleted?
        │               ├── YES → Done
        │               └── NO → Start tour (only if just created program)
        └── NO → welcomeSeen?
                  ├── YES → Show program wizard
                  └── NO → Show welcome screen
                            └── User clicks "Start"
                                  └── Show program wizard
                                        └── Program created
                                              └── Navigate to HomePage
                                                    └── Start tour
```

---

## Files to Create/Modify

### New Components
| File | Purpose |
|------|---------|
| `src/components/Onboarding/WelcomeScreen.tsx` | Welcome screen before wizard |
| `src/components/Onboarding/GuidedTour.tsx` | Tour orchestrator component |
| `src/components/Onboarding/TourTooltip.tsx` | Tooltip with content and controls |
| `src/components/Onboarding/Spotlight.tsx` | Clip-path based highlight overlay |
| `src/hooks/useOnboarding.ts` | Onboarding state management |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/HomePage.tsx` | Add tour trigger, data-tour attributes on elements |
| `src/components/AIProgramWizard/index.tsx` | Pass callback for "first program created" |

---

## Acceptance Criteria

### Welcome Screen
- [ ] New users without programs see welcome screen first
- [ ] Welcome screen explains the 3-step process with benefit-focused copy
- [ ] "Start" button leads to program creation wizard
- [ ] Welcome screen is not shown again after dismissal
- [ ] Subtle entrance animation (respects reduced motion preference)
- [ ] Works on mobile (375px) and desktop

### Guided Tour
- [ ] Tour starts automatically after first program creation
- [ ] Tour highlights each visible section with spotlight effect
- [ ] Tooltips explain each section with action-oriented copy
- [ ] Progress shown as visual dots
- [ ] "Volgende" advances to next step
- [ ] "Overslaan" dismisses tour entirely
- [ ] Tour skips sections that aren't visible
- [ ] Tour is not shown again after completion/skip
- [ ] Smooth animations between steps (< 500ms)
- [ ] Scroll-to-element if target is off-screen
- [ ] Keyboard navigation works
- [ ] Screen reader announces step changes
- [ ] Works on mobile viewport

---

## Edge Cases

- User refreshes during tour: Don't auto-resume, mark as abandoned
- Element not visible: Skip that step, adjust step count
- User navigates away during tour: End tour, mark as seen
- Very small screen: Ensure tooltip positioning doesn't overflow
- Device rotation: Recalculate spotlight and tooltip positions
- Network error during wizard: Tour should still work on homepage

---

## Testing Checklist

- [ ] VoiceOver (iOS) screen reader flow
- [ ] TalkBack (Android) screen reader flow
- [ ] Landscape orientation on mobile
- [ ] iPads and larger phones (430px width)
- [ ] Dark mode appearance
- [ ] 200% browser zoom
- [ ] `prefers-reduced-motion` behavior
