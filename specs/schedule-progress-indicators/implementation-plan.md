# Implementation Plan: Schedule Progress Indicators

## Status: IMPLEMENTED

All tasks have been completed.

## Changes Made

### 1. API Enhancement (`api/programs/[id].ts`)

**Added `completedMethodIds` to each session:**
- Fetches method usage records from Postgres via `methodUsageRepo`
- Maps usage records to identify which methods have been completed per session
- Adds `completedMethodIds` array to each schedule entry

**Fixed `completedSessions` calculation:**
- A session is complete when all its scheduled methods have corresponding method usage records
- `completedSessions = schedule.filter(s => s.completedMethodIds.length >= s.methodIds.length).length`

### 2. TypeScript Types (`src/types/program.ts`)

Added `completedMethodIds` to Programmaplanning interface:
```typescript
export interface Programmaplanning {
  // ... existing fields
  completedMethodIds: string[]  // Method IDs that have been completed
}
```

### 3. FullScheduleSection (`src/components/FullScheduleSection.tsx`)

**Session-level indicator:**
- Complete: Green filled circle with checkmark
- Partial: Border circle with completion count
- Not started: Empty border circle

**Per-method indicators:**
- Completed: Green pill with `CheckCircle` icon
- Pending: Gray pill with `Circle` icon

### 4. HomePage (`src/pages/HomePage.tsx`)

**Today's activity with checkmarks:**
- Completed methods show green background and `CheckCircle` icon
- Pending methods show gray background and `ChevronRight` icon

## Files Changed

| File | Changes |
|------|---------|
| `api/programs/[id].ts` | Added completedMethodIds fetch, fixed completedSessions calculation |
| `src/types/program.ts` | Added completedMethodIds to Programmaplanning interface |
| `src/components/FullScheduleSection.tsx` | Added per-method indicators with completion status |
| `src/pages/HomePage.tsx` | Added checkmarks for completed methods in today's activity |

## Testing

1. Complete a method from today's schedule
2. Verify checkmark appears in "Activiteit van Vandaag"
3. Verify method shows as completed in "Volledige Planning"
4. Complete all methods for a day
5. Verify session shows green checkmark
6. Verify progress "X van Y sessies" increments
