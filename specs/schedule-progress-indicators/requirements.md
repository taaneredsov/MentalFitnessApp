# Requirements: Schedule Progress Indicators

## Overview

Show visual progress indicators on the program schedule to indicate:
1. **Session-level completion**: Whether all methods for a scheduled day have been completed
2. **Method-level completion**: Per-method indicators showing which specific methods have been done

This hooks into the existing [method-usage-tracking](../method-usage-tracking/) spec which tracks method usage at the Programmaplanning level.

## User Story

As a user following a mental fitness program, I want to see at a glance which scheduled days I've completed and which specific methods I've done, so I can track my daily progress and know what remains.

## Visual Indicators

### Session-Level (Day) Indicators

| State | Visual | Description |
|-------|--------|-------------|
| Not started | Empty circle (border only) | No methods completed for this day |
| In progress | Circle with number | Shows count of completed methods (e.g., "1" if 1 of 2 done) |
| Complete | Filled green circle + checkmark | All scheduled methods completed |

### Method-Level Indicators

| State | Visual | Description |
|-------|--------|-------------|
| Not done | Gray pill with empty circle | Method not yet completed |
| Done | Green pill with checkmark | Method completed (has MethodUsage record) |

## Data Flow

```
Programmaplanning (scheduled session)
  ├── methodIds[] (scheduled methods for this day)
  └── methodUsageIds[] (link to MethodUsage records)
        └── MethodUsage.methodId (completed method)

completedMethodIds = methodUsageIds.map(id => MethodUsage[id].methodId)

Session is complete when: completedMethodIds.length >= methodIds.length
```

## Functional Requirements

### 1. API Enhancement
- `GET /api/programs/[id]` must return `completedMethodIds` for each Programmaplanning
- `completedSessions` count must be calculated based on actual method completion (not static `isCompleted` field)

### 2. Full Schedule View (FullScheduleSection)
- Show session-level completion indicator (circle with state)
- Show per-method completion with colored pills
- Completed methods: green background with checkmark icon
- Pending methods: gray background with empty circle icon

### 3. Today's Activity (HomePage)
- Show checkmark on completed methods in today's session
- Visual distinction: green background/ring for completed items

### 4. Progress Calculation
- Progress = completed sessions / total sessions
- A session is "completed" when ALL its scheduled methods have MethodUsage records

## Acceptance Criteria

- [x] Each method in the schedule shows completed/pending status
- [x] Session shows green checkmark when all methods are done
- [x] Session shows partial progress (number) when some methods are done
- [x] Progress bar updates based on actual method usage, not static field
- [x] Today's activity shows checkmarks for completed methods
- [x] "X van Y sessies" count reflects actual completion

## Dependencies

- [method-usage-tracking](../method-usage-tracking/) - Provides the MethodUsage records
- Programmaplanning.methodUsageIds field (linked records)
- MethodUsage.methodId field (to identify which method was completed)

## Related Components

| Component | Purpose |
|-----------|---------|
| `src/components/FullScheduleSection.tsx` | Full schedule with per-method indicators |
| `src/pages/HomePage.tsx` | Today's activity with checkmarks |
| `src/pages/ProgramDetailPage.tsx` | Program overview with progress bar |
| `api/programs/[id].ts` | API returning completedMethodIds and session counts |
