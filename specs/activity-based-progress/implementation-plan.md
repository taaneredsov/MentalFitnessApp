# Implementation Plan: Activity-based Program Progress

## Overview

Replace the time-based progress calculation with an activity-based calculation. Progress will be measured as the ratio of completed activities (Methodegebruik records) to total expected activities (weeks × frequency).

## Phase 1: Update API to Return Activity Count

Add the completed activity count to the program data returned by the API.

### Tasks

- [ ] Add `methodUsageCount` field to Program type in `src/types/program.ts`
- [ ] Update `transformProgram` in `api/_lib/field-mappings.js` to include methodUsage array length
- [ ] Verify programs API returns the activity count

### Technical Details

**File: `src/types/program.ts`**
Add to Program interface:
```typescript
export interface Program {
  // ... existing fields
  methodUsageCount?: number  // Count of linked Methodegebruik records
}
```

**File: `api/_lib/field-mappings.js`**
Update `transformProgram` function:
```javascript
export function transformProgram(record) {
  const fields = record.fields
  return {
    // ... existing fields
    methodUsageCount: (fields[PROGRAM_FIELDS.methodUsage] || []).length
  }
}
```

**Field IDs:**
- `PROGRAM_FIELDS.methodUsage`: `fldXNUYtU4KG84ZMX` (already added)
- `PROGRAM_FIELDS.duration`: `fld3mrRTtqPX2a1fX` (e.g., "4 weken")
- `PROGRAM_FIELDS.frequency`: `fldIGX4ZfG9LyYgMt` (count of days per week)

## Phase 2: Create Progress Calculation Utility

Create a shared utility function to calculate activity-based progress.

### Tasks

- [ ] Create `parseWeeksFromDuration` helper function to extract weeks from duration string
- [ ] Create `getActivityProgress` function that calculates progress percentage
- [ ] Export functions from `src/types/program.ts`

### Technical Details

**File: `src/types/program.ts`**

```typescript
/**
 * Parse weeks from duration string (e.g., "4 weken" -> 4)
 */
export function parseWeeksFromDuration(duration: string): number {
  const match = duration.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Calculate activity-based progress percentage
 */
export function getActivityProgress(program: Program): number {
  const weeks = parseWeeksFromDuration(program.duration)
  const frequency = program.frequency || 0
  const totalExpected = weeks * frequency

  if (totalExpected === 0) return 0

  const completed = program.methodUsageCount || 0
  const progress = Math.round((completed / totalExpected) * 100)

  return Math.min(progress, 100) // Cap at 100%
}
```

**Duration format examples:**
- "4 weken" → 4 weeks
- "6 weken" → 6 weeks
- "8 weken" → 8 weeks

## Phase 3: Update UI Components

Replace time-based progress with activity-based progress in all UI components.

### Tasks

- [ ] Update `HomePage.tsx` to use `getActivityProgress` instead of `getProgress`
- [ ] Update `ProgramCard.tsx` to use `getActivityProgress` instead of `getProgress`
- [ ] Remove old `getProgress` functions from both files

### Technical Details

**File: `src/pages/HomePage.tsx`**

Remove:
```typescript
function getProgress(program: Program): number {
  const start = new Date(program.startDate).getTime()
  const end = new Date(program.endDate).getTime()
  const now = Date.now()
  // ... time-based calculation
}
```

Replace with import:
```typescript
import { getActivityProgress } from "@/types/program"
```

Update usage:
```typescript
// Before
<span>{getProgress(runningProgram)}%</span>

// After
<span>{getActivityProgress(runningProgram)}%</span>
```

**File: `src/components/ProgramCard.tsx`**

Same pattern - remove local `getProgress` function and import `getActivityProgress`.

```typescript
import { getActivityProgress } from "@/types/program"

// In component:
const progress = status === "running" ? getActivityProgress(program) : null
```

## Phase 4: Update Program Detail Page

Ensure the program detail page also shows activity-based progress if needed.

### Tasks

- [ ] Verify `ProgramDetailPage.tsx` shows correct progress (if applicable)
- [ ] Consider showing "X van Y activiteiten voltooid" text

### Technical Details

**Optional enhancement for ProgramDetailPage:**
```typescript
const weeks = parseWeeksFromDuration(program.duration)
const totalActivities = weeks * program.frequency
const completedActivities = recentActivities.length // or from API

// Display: "2 van 8 activiteiten voltooid"
```

## Summary of Changes

| File | Change |
|------|--------|
| `src/types/program.ts` | Add `methodUsageCount` to Program, add `parseWeeksFromDuration` and `getActivityProgress` functions |
| `api/_lib/field-mappings.js` | Update `transformProgram` to include `methodUsageCount` |
| `src/pages/HomePage.tsx` | Replace `getProgress` with `getActivityProgress` |
| `src/components/ProgramCard.tsx` | Replace `getProgress` with `getActivityProgress` |
| `src/pages/ProgramDetailPage.tsx` | Optional: show activity count text |
