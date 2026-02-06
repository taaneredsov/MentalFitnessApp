# Requirements: Methods Search

## Overview

Search and filter methods on the Methods screen (`/methods`) by text query and by Doelstelling (goal) selection.

## User Story

As a user, I want to search for methods by name, description, or goal, and filter by a specific Doelstelling, so that I can quickly find relevant methods.

## Acceptance Criteria

### Phase 1: Text Search [DONE]

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

### Phase 2: Doelstelling Filter + Description Search

4. **Doelstelling Selection Filter**
   - Horizontal scrollable row of filter chips below the search input
   - One chip per goal (Doelstelling), excluding "Goede gewoontes"
   - "Alle" chip shown first, selected by default
   - Tapping a chip filters to methods linked to that goal
   - Active chip is visually distinct (filled/primary color)
   - Only one goal can be selected at a time (single select)

5. **Description Search**
   - Text search also matches against method description
   - Doelstelling filter and text search work together (AND logic):
     - If a goal is selected AND search text is entered, show methods that match both

6. **Combined UX**
   - Selecting a goal chip does not clear the search input (and vice versa)
   - Clear button on search only clears text, not the goal filter
   - "Alle" chip resets the goal filter

## Dependencies

- Uses existing `useMethods()` and `useGoals()` hooks (already loaded in MethodsPage)
- Uses existing `Input` component from `@/components/ui/input`
- Uses Lucide icons (`Search`, `X`)

## Out of Scope

- Server-side search
- Search history or suggestions
- Advanced filters (duration, experience level)
- Multi-select goals
