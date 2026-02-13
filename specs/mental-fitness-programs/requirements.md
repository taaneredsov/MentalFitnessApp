# Requirements: Mental Fitness Programs

## Overview

Display and manage user's Mental Fitness Programs (Mentale Fitnessprogramma's) throughout the application. Programs have start/end dates, weekly schedules, linked goals, and methods.

## User Stories

### As a user, I want to:

1. **View all my programs** on the Programs tab (Tab1), grouped by status:
   - Running (currently active)
   - Planned (starts in the future)
   - Finished (already completed)

2. **See program details** including:
   - Start and end dates
   - Duration (1-12 weeks)
   - Weekly schedule (which days)
   - Frequency (sessions per week)
   - Linked goals
   - Assigned methods
   - Estimated time per session

3. **See my running program on the Home page** with:
   - Program name and progress
   - Upcoming activity (next open scheduled session)
   - Methods for the next session
   - Time estimate

4. **See a clear state when no next open activity exists**:
   - Do not show "Volgende Activiteit" when there is no real open session today/future
   - Show clear actions: extend current program or create a new one

## Acceptance Criteria

### Programs Overview (Tab1)
- [ ] Tab1 renamed to "Programs" in bottom navigation
- [ ] Programs grouped into Running, Planned, Finished sections
- [ ] Each program card shows: dates, frequency, progress indicator
- [ ] Empty states for sections with no programs
- [ ] Clicking a program navigates to detail page

### Program Detail Page
- [ ] Shows all program information
- [ ] Lists schedule days (e.g., "Maandag, Woensdag, Vrijdag")
- [ ] Lists linked goals with status
- [ ] Lists assigned methods with duration
- [ ] Back button returns to Programs overview

### Home Page
- [ ] Shows running program card (if any)
- [ ] Shows upcoming activity with next **open** scheduled session
- [ ] Shows methods for next open session
- [ ] Handles case when no running program exists
- [ ] Does not show "Volgende Activiteit" when no future/today open session exists
- [ ] For ended + incomplete programs, shows a dedicated "Programma afgelopen" state with:
  - [ ] Primary action: "Programma verlengen" (recalculate schedule)
  - [ ] Secondary action: "Maak nieuw programma"
- [ ] For no-next-open-session + incomplete programs that are not clearly ended yet, shows "Geen volgende activiteit" with "Programma verlengen"
- [ ] For ended + completed programs, shows a completion state with "Maak nieuw programma"
- [ ] "Programma verlengen" opens an extension picker with options: 2, 4, 6 weken

## Data Model

### Program Status Logic
```
planned: startDate > today
running: startDate <= today <= endDate
finished: endDate < today
```

### Upcoming Activity Logic
Find the next **open** session in Programmaplanning (today first, then future), where:

```
openSession = completedMethodIds < methodIds
```

### Ended Program Edge Case Logic
Use session availability + completion to determine the Home top-card state:

```
ended = endDate <= today
completed = completedSessions >= totalSessions
hasNextOpenSession = exists schedule session with date >= today and not completed
```

Rules:
1. If `hasNextOpenSession`, show "Volgende Activiteit".
2. If `!hasNextOpenSession` and `!completed`, show fallback state with `Programma verlengen` + `Maak nieuw programma`.
3. Prefer title "Programma afgelopen" when ended by date; otherwise use "Geen volgende activiteit".
4. If `!hasNextOpenSession` and `completed`, show completion state + `Maak nieuw programma`.
5. Never show weekday fallback text (e.g. "dinsdag") when no real upcoming session exists.

## Dependencies

- Existing authentication system (useAuth hook)
- Existing API client pattern (api-client.ts)
- Existing field-mappings.js for Airtable field IDs
- UI components: Card, Button from shadcn/ui
- Program extend endpoint (`POST /api/programs/[id]/extend`) for extend action

## Related Tables (Airtable)

- Programs: `tblqW4xeCx1tprNgX`
- Programmaplanning: `tbl2PHUaonvs1MYRx` (scheduled sessions)
- Days of Week: `tblS3gleG8cSlWOJ3`
- Goals: `tbl6ngkyNrv0LFzGb`
- Methods: `tblB0QvbGg3zWARt4`

## Integration with Other Specs

### Programmaplanning (Scheduled Sessions)

For AI-generated programs, the schedule is stored in **Programmaplanning** records:
- Each record = one scheduled session (specific date + methods)
- Links back to parent Program
- Tracks completion via `methodUsage` field

### Related Specs

| Spec | Relationship |
|------|--------------|
| **method-usage-tracking** | When user completes a method from schedule, creates Method Usage linked to Programmaplanning |
| **activity-based-progress** | Progress = completed Programmaplanning / total Programmaplanning |

### Schedule Display

When showing a program's schedule:
1. **AI-generated programs**: Use Programmaplanning records (specific dates with methods)
2. **Legacy programs**: Use Days of Week field (generic weekly schedule)

The schedule should show:
- Date (from Programmaplanning.date)
- Methods planned for that session
- Completion status (checkmark if Programmaplanning.methodUsage has records)
