# Requirements: Methods Search

## Overview

Add a search input to the Methods screen (`/methods`) that allows users to filter methods by name and linked goals (Doelstelling).

## User Story

As a user, I want to search for methods on the Methods screen so that I can quickly find relevant methods based on their name or associated goals.

## Acceptance Criteria

1. **Search Input**
   - A search input field is displayed at the top of the Methods screen
   - The input has a search icon and placeholder text "Zoek methodes..."
   - The input has a clear button (X) when text is entered

2. **Search Behavior**
   - Search filters methods in real-time as the user types
   - Search is case-insensitive
   - Search matches against:
     - Method name
     - Linked goal names (Doelstelling) - resolved from `linkedGoalIds`
   - Empty search shows all methods (default behavior)

3. **Results Display**
   - Filtered results update immediately (no debounce needed for client-side filtering)
   - If no results match, show "Geen methodes gevonden" message
   - The existing "Goede gewoontes" filter remains active (search filters within those results)

4. **UX Requirements**
   - Search input is sticky/visible while scrolling through methods
   - Clear button appears only when search has text
   - Responsive design matching existing UI patterns

## Dependencies

- Uses existing `useMethods()` and `useGoals()` hooks (already loaded in MethodsPage)
- Uses existing `Input` component from `@/components/ui/input`
- Uses Lucide icons (`Search`, `X`)

## Out of Scope

- Server-side search
- Search history or suggestions
- Advanced filters (duration, experience level)
