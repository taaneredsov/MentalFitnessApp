# Implementation Plan: Activity-based Program Progress

## Overview

Replace the time-based progress calculation with a **Programmaplanning-based** calculation. Progress will be measured as the ratio of completed scheduled sessions (Programmaplanning with methodUsage) to total scheduled sessions.

## Pre-requisites

Depends on **method-usage-tracking** spec:
- Method Usage must link to Programmaplanning (not Program)
- Programmaplanning.methodUsage field must be populated when Method Usage is created

---

## Phase 1: Update API to Return Session Counts

Add the session counts to the program data returned by the API.

### Tasks

- [x] Add `totalMethods` and `completedMethods` fields to Program type (method-based approach)
- [x] Create API endpoint to fetch method usage data
- [x] Calculate completed count (methodUsageCount from Airtable)
- [x] Return counts in program response
- [ ] **Future**: Add session-based progress (totalSessions/completedSessions)

### Technical Details

**File: `src/types/program.ts`**
```typescript
export interface Program {
  // ... existing fields
  totalSessions: number       // Count of Programmaplanning records
  completedSessions: number   // Count with at least one methodUsage
}
```

**Option A: Add to existing programs API**

Update `api/programs/index.ts` and `api/programs/[id].ts` to:
1. Fetch Programmaplanning records for each program
2. Count total and completed
3. Include in response

**Option B: Create dedicated endpoint**

Create `api/programs/[id]/progress.ts`:
```typescript
// GET /api/programs/:id/progress
// Returns: { totalSessions: number, completedSessions: number, progress: number }
```

**Recommended: Option A** - Include counts in existing program responses for efficiency.

**API Implementation:**
```typescript
// In api/programs/[id].ts or similar
import { base, tables } from "../_lib/airtable.js"
import { PROGRAMMAPLANNING_FIELDS } from "../_lib/field-mappings.js"

// Fetch Programmaplanning for this program
const scheduleRecords = await base(tables.programmaplanning)
  .select({
    filterByFormula: `{Mentale Fitnessprogramma} = "${programId}"`,
    returnFieldsByFieldId: true
  })
  .all()

const totalSessions = scheduleRecords.length
const completedSessions = scheduleRecords.filter(record =>
  (record.fields[PROGRAMMAPLANNING_FIELDS.methodUsage] || []).length > 0
).length

// Include in response
return {
  ...program,
  totalSessions,
  completedSessions
}
```

---

## Phase 2: Create Progress Calculation Utility

Create a shared utility function to calculate Programmaplanning-based progress.

### Tasks

- [x] Create `getMethodProgress` function (method-based calculation)
- [x] Handle edge cases (no methods, all completed)
- [x] Export from `src/types/program.ts`
- [ ] **Future**: Create session-based `getSessionProgress` function

### Technical Details

**File: `src/types/program.ts`**

```typescript
/**
 * Calculate Programmaplanning-based progress percentage
 *
 * @param program - Program with totalSessions and completedSessions
 * @returns Progress percentage (0-100)
 */
export function getSessionProgress(program: Program): number {
  const { totalSessions, completedSessions } = program

  // No sessions scheduled yet
  if (!totalSessions || totalSessions === 0) return 0

  // Calculate percentage
  const progress = Math.round((completedSessions / totalSessions) * 100)

  // Cap at 100%
  return Math.min(progress, 100)
}
```

**Usage:**
```typescript
import { getSessionProgress } from "@/types/program"

// In component
const progress = getSessionProgress(program)
// progress = 42 (meaning 42%)
```

---

## Phase 3: Update UI Components

Replace time-based progress with Programmaplanning-based progress in all UI components.

### Tasks

- [x] Update `HomePage.tsx` to use method-based progress
- [x] Update `ProgramCard.tsx` to use method-based progress
- [x] Remove old time-based `getProgress` functions
- [x] Handle programs without method usage data (show 0%)

### Technical Details

**File: `src/pages/HomePage.tsx`**

Remove old functions:
```typescript
// REMOVE
function getProgress(program: Program): number {
  // ... time-based calculation
}

// REMOVE (if exists)
function getActivityProgress(program: Program): number {
  // ... methodUsageCount-based calculation
}
```

Add import and use:
```typescript
import { getSessionProgress } from "@/types/program"

// In component
<span>{getSessionProgress(runningProgram)}%</span>
```

**File: `src/components/ProgramCard.tsx`**

```typescript
import { getSessionProgress } from "@/types/program"

// In component
const progress = status === "running" ? getSessionProgress(program) : null

// Or show for all statuses
const progress = getSessionProgress(program)
```

---

## Phase 4: Update Program Detail Page

Show detailed progress on the program detail page.

### Tasks

- [x] Display progress percentage based on methods completed
- [x] Show progress bar on ProgramCard and detail page
- [x] Visual progress indicator in running program section

### Technical Details

**File: `src/pages/ProgramDetailPage.tsx`**

```typescript
// Display text
<p className="text-sm text-muted-foreground">
  {program.completedSessions} van {program.totalSessions} sessies voltooid
</p>

// Progress bar with percentage
<Progress value={getSessionProgress(program)} />
<span>{getSessionProgress(program)}%</span>
```

**Schedule display with completion status:**
```typescript
// Assuming schedule is fetched with isCompleted flag
{schedule.map(session => (
  <div key={session.id} className="flex items-center gap-2">
    {session.isCompleted ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <Circle className="h-4 w-4 text-muted-foreground" />
    )}
    <span>{formatDate(session.date)}</span>
    <span className="text-muted-foreground">
      {session.methods.map(m => m.name).join(", ")}
    </span>
  </div>
))}
```

---

## Phase 5: Fetch Schedule with Completion Status

Update API to return schedule with completion status.

### Tasks

- [ ] Create/update endpoint to return Programmaplanning with completion flag
- [ ] Include methodUsage status in each schedule item
- [ ] Update frontend to use schedule data

> **Note**: Phase 5 is optional enhancement. Current implementation uses method-count-based progress which is functional.

### Technical Details

**API response structure:**
```typescript
interface ScheduleItem {
  id: string
  date: string
  dayOfWeek: string
  isCompleted: boolean
  methods: Array<{
    id: string
    name: string
    duration: number
  }>
}

interface ProgramDetail extends Program {
  schedule: ScheduleItem[]
}
```

**Transformation in field-mappings.js:**
```javascript
export function transformProgrammaplanningWithStatus(record) {
  const fields = record.fields
  const methodUsageIds = fields[PROGRAMMAPLANNING_FIELDS.methodUsage] || []

  return {
    id: record.id,
    date: fields[PROGRAMMAPLANNING_FIELDS.date],
    dayOfWeekId: fields[PROGRAMMAPLANNING_FIELDS.dayOfWeek]?.[0],
    isCompleted: methodUsageIds.length > 0,
    methodIds: fields[PROGRAMMAPLANNING_FIELDS.methods] || []
  }
}
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/types/program.ts` | Add `totalSessions`, `completedSessions`; add `getSessionProgress()` |
| `api/_lib/field-mappings.js` | Add `transformProgrammaplanningWithStatus()` |
| `api/programs/[id].ts` | Return session counts and schedule with completion status |
| `src/pages/HomePage.tsx` | Use `getSessionProgress()` |
| `src/components/ProgramCard.tsx` | Use `getSessionProgress()` |
| `src/pages/ProgramDetailPage.tsx` | Show "X van Y" text and schedule with checkmarks |

---

## Migration from Previous Approaches

### From Time-based
- Remove `getProgress()` functions that use date math
- Replace with `getSessionProgress()`

### From methodUsageCount-based
- Remove `methodUsageCount` from Program type (if added)
- Remove `parseWeeksFromDuration()` and `getActivityProgress()` (if added)
- Replace with `totalSessions` and `completedSessions`

### Backward Compatibility

For programs without Programmaplanning records (legacy):
- `totalSessions = 0`
- `completedSessions = 0`
- `getSessionProgress()` returns `0`

Consider generating Programmaplanning for legacy programs to enable progress tracking.

---

## Verification

1. Create a program with AI-generated schedule (Programmaplanning records)
2. Verify totalSessions matches Programmaplanning count
3. Complete a method from the schedule
4. Verify completedSessions increases
5. Verify progress percentage updates on HomePage and ProgramCard
6. Verify ProgramDetailPage shows "X van Y sessies voltooid"
7. Verify schedule shows checkmarks for completed sessions
