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
   - Upcoming activity (next scheduled day)
   - Methods for the next session
   - Time estimate

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
- [ ] Shows upcoming activity with next scheduled day
- [ ] Shows methods for next session
- [ ] Handles case when no running program exists

## Data Model

### Program Status Logic
```
planned: startDate > today
running: startDate <= today <= endDate
finished: endDate < today
```

### Upcoming Activity Logic
Find the next day in the weekly schedule (starting from today).

## Dependencies

- Existing authentication system (useAuth hook)
- Existing API client pattern (api-client.ts)
- Existing field-mappings.js for Airtable field IDs
- UI components: Card, Button from shadcn/ui

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
