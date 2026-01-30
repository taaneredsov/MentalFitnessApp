# Requirements: Edit Running Program

## Overview

Allow users to modify their active ("Actief") program after it has started. Currently, once a program is created, users cannot change the schedule, methods, or goals - which limits flexibility when life circumstances change or the program isn't a good fit.

## Problem Statement

Users need to adapt their mental fitness programs to:
- Add new methods they've discovered
- Remove methods that don't work for them
- Adjust session content based on availability
- Update goals as priorities change

Without this capability, users are stuck with their initial program configuration or must abandon and restart entirely.

## User Stories

### US-1: Edit Session Methods
**As a** user with a running program
**I want to** add or remove methods from a specific session
**So that** I can customize each training day to my current needs

### US-2: Edit Future Sessions Only
**As a** user with a running program
**I want to** only edit sessions that haven't happened yet
**So that** my historical completion data remains accurate

### US-3: Edit Program Goals
**As a** user with a running program
**I want to** update the goals associated with my program
**So that** I can refocus my training as my priorities evolve

### US-4: View Edit Options
**As a** user viewing my program details
**I want to** see clear edit buttons for editable items
**So that** I know what can be modified

## Functional Requirements

### FR-1: Session Editing
- Users can edit methods for any **future** session (date > today)
- Users can add methods from the available methods pool
- Users can remove methods from a session
- Minimum 1 method must remain in each session
- Session date and day of week cannot be changed
- Past sessions (date <= today) are read-only

### FR-2: Program-Level Editing
- Users can update program notes
- Users can update linked goals
- Users CANNOT change: startDate, endDate, duration, daysOfWeek (would require schedule regeneration - future scope)

### FR-3: Data Integrity
- Existing MethodUsage records remain intact when session is edited
- Completed sessions cannot be modified
- Historical data preserved for accurate progress tracking

### FR-4: UI/UX
- Edit button visible on ProgramDetailPage for "Actief" programs only
- Clear visual distinction between editable (future) and locked (past) sessions
- Method picker reused from AI Program Wizard for consistency
- Optimistic updates for responsive feel

## Non-Functional Requirements

### NFR-1: Performance
- Session updates should complete in < 2 seconds
- Optimistic UI updates for immediate feedback

### NFR-2: Security
- Verify user owns the program before allowing edits
- Validate all method/goal IDs exist before saving

### NFR-3: Accessibility
- Edit dialogs keyboard navigable
- Focus management on dialog open/close

## Acceptance Criteria

### AC-1: Session Edit Flow
- [ ] User can click edit icon on a future session
- [ ] Dialog opens showing current methods with remove option
- [ ] User can add methods from available pool
- [ ] Save updates the session in Airtable
- [ ] UI reflects changes immediately
- [ ] Past sessions show no edit option

### AC-2: Program Edit Flow
- [ ] User can click edit button on program details
- [ ] Dialog shows editable fields (goals, notes)
- [ ] Save updates program in Airtable
- [ ] Changes reflected in UI

### AC-3: Error Handling
- [ ] Cannot save session with zero methods
- [ ] Network errors show user-friendly message
- [ ] Validation errors clearly explained

## Dependencies

- Existing `useProgram` hook for fetching program details
- Existing `useUpdateProgram` mutation for program-level updates
- `api/programs/[id].ts` PATCH endpoint (exists, may need enhancement)
- Airtable Programmaplanning table with field mappings

## Out of Scope (Future Enhancements)

- Changing program dates/duration (requires schedule regeneration)
- Changing daysOfWeek (requires schedule regeneration)
- Adding/removing entire sessions
- Bulk editing multiple sessions at once
- AI-assisted schedule optimization after edits

## Related Features

- [Personal Goals](../personal-goals/) - Similar edit pattern
- [One Active Program Limit](../../docs/features/one-active-program-limit.md) - Status field used to determine editability
- [Score Widgets](../../docs/features/score-widgets.md) - May be affected if methods change
