# Requirements: Pull-to-Refresh

## Overview

Add pull-to-refresh functionality to the HomePage, allowing users to manually refresh their program data by pulling down on the screen. This is a common mobile UX pattern that provides tactile feedback and user control over data freshness.

## User Story

As a user on the homepage, I want to pull down on the screen to refresh my program data, so that I can see the latest updates without navigating away or reloading the app.

## Functional Requirements

### Pull-to-Refresh Gesture

1. **Trigger**: User pulls down on the homepage content area
2. **Visual feedback**: Show a spinner/loading indicator while refreshing
3. **Data refresh**: Invalidate React Query cache and refetch program data
4. **Completion**: Hide spinner and show updated content when fetch completes
5. **Error handling**: Show brief error toast if refresh fails, keep existing data

### Scope

- **Primary**: HomePage (running program, today's activity, full schedule)
- **Future consideration**: Could extend to ProgramDetailPage, MethodsPage

## Non-Functional Requirements

- Works on both iOS and Android PWA
- Smooth 60fps animation during pull gesture
- Accessible (works with screen readers)
- Does not interfere with normal scrolling behavior
- Respects reduced-motion preferences

## Technical Approach

Use a lightweight pull-to-refresh library compatible with React:
- Option 1: `react-pull-to-refresh` - Simple, lightweight
- Option 2: `pulltorefreshjs` - Framework-agnostic, works with any scroll container
- Option 3: Custom implementation using touch events

Recommended: Use `pulltorefreshjs` as it's well-maintained, lightweight (~3KB), and works well with PWAs.

## Acceptance Criteria

- [ ] Pulling down on HomePage shows a loading indicator
- [ ] Release triggers data refetch via React Query invalidation
- [ ] Updated data appears after refresh completes
- [ ] Works on mobile devices (iOS Safari, Android Chrome)
- [ ] Works on desktop with mouse drag (optional, nice-to-have)
- [ ] No visual glitches during animation
- [ ] Spinner disappears after refresh completes or fails

## Dependencies

- React Query (already in use for data fetching)
- Touch events API (browser native)

## Related Features

- [schedule-progress-indicators](../schedule-progress-indicators/) - Progress data that benefits from refresh
- [method-usage-tracking](../method-usage-tracking/) - Usage data that may update externally
