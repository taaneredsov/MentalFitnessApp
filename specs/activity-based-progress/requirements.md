# Requirements: Activity-based Program Progress

## Summary

Change the "Voortgang" (Progress) calculation on program cards from time-based to activity-based measurement. Progress should reflect actual completed **scheduled sessions (Programmaplanning)** rather than elapsed time or raw method usage counts.

## Current Behavior

Progress is calculated based on time elapsed:
- `progress = (today - startDate) / (endDate - startDate) × 100`
- This doesn't reflect actual user engagement or completion

## Desired Behavior

Progress should be calculated based on **completed Programmaplanning sessions**:
- `progress = completedSessions / totalSessions × 100`
- **Total sessions** = count of Programmaplanning records for the program
- **Completed sessions** = count of Programmaplanning records that have at least one methodUsage linked

### Why Programmaplanning-based?

The previous approach counted method usages:
- `completedActivities = count of Methodegebruik records linked to program`
- `totalExpected = weeks × frequency`

This had issues:
1. **Inaccurate total**: `weeks × frequency` is an estimate, not actual scheduled sessions
2. **Multiple methods per day**: One session may have multiple methods, inflating completion
3. **No session granularity**: Can't show which specific days are done

The new Programmaplanning-based approach:
1. **Accurate total**: Exact count of scheduled sessions
2. **Session-level tracking**: One Programmaplanning = one scheduled day
3. **Clear completion**: A session is "done" when user has completed it (has methodUsage)

## Data Model

### Key Tables

```
Program (Mentale Fitnessprogramma's)
  └── programmaplanning[] (fldRXKcLTLbdMGgfR - link to Programmaplanning)

Programmaplanning (tbl2PHUaonvs1MYRx)
  ├── program (fldTPzVYhmSBxYRa3 - link to Program)
  ├── date (fldvqnZDdjaVxB25H)
  ├── methods[] (fldxQn8r2ySIFs4pg - planned methods)
  └── methodUsage[] (fldoxGlLYZ5NI60hl - completed usages)

Method Usage (tblktNOXF3yPPavXU)
  └── programmaplanning (fld??? - link to Programmaplanning)
```

### Completion Logic

A Programmaplanning session is considered **completed** when:
- `methodUsage.length > 0` (at least one method has been completed)

Optional stricter definition:
- All planned methods have corresponding methodUsage records

## Example

A program with a generated schedule:
- **Total Programmaplanning records**: 12 (e.g., 3 sessions/week × 4 weeks)
- **Completed sessions**: 5 (5 Programmaplanning records have methodUsage linked)
- **Progress**: 5 / 12 = **42%**

## Data Sources

### Program Table (tblqW4xeCx1tprNgX)
| Field | ID | Description |
|-------|-----|-------------|
| Programmaplanning | `fldRXKcLTLbdMGgfR` | Link to scheduled sessions |

> **Note**: Need to verify this field exists or add it. The schedule may be accessed via reverse lookup from Programmaplanning.program.

### Programmaplanning Table (tbl2PHUaonvs1MYRx)
| Field | ID | Description |
|-------|-----|-------------|
| Mentale Fitnessprogramma | `fldTPzVYhmSBxYRa3` | Link to parent program |
| Methodegebruik | `fldoxGlLYZ5NI60hl` | Link to completed Method Usage |

### Progress Calculation

```typescript
// Fetch all Programmaplanning records for the program
const schedule = await fetchProgrammaplanning(programId)

// Count completed sessions (those with at least one methodUsage)
const completedSessions = schedule.filter(s =>
  (s.methodUsageIds || []).length > 0
).length

const totalSessions = schedule.length

// Calculate progress
const progress = totalSessions > 0
  ? Math.min(Math.round((completedSessions / totalSessions) * 100), 100)
  : 0
```

## Acceptance Criteria

- [ ] Progress bar on HomePage "Huidig Programma" card shows Programmaplanning-based progress
- [ ] Progress bar on ProgramCard (Programma's page) shows Programmaplanning-based progress
- [ ] Progress percentage is calculated as: `(completed Programmaplanning count / total Programmaplanning count) × 100`
- [ ] A Programmaplanning is "completed" when it has at least one methodUsage linked
- [ ] Progress caps at 100% even if more sessions are completed than scheduled
- [ ] Progress shows 0% when no sessions are completed
- [ ] Programs without Programmaplanning records show 0% progress

## Dependencies

- **method-usage-tracking**: Must link Method Usage to Programmaplanning (not Program)
- **mental-fitness-programs**: Schedule display uses Programmaplanning records
- API must return Programmaplanning with methodUsage populated

## Affected Components

- `src/pages/HomePage.tsx` - getProgress function
- `src/components/ProgramCard.tsx` - getProgress function
- `src/types/program.ts` - Program type needs schedule/completedCount
- `api/programs/[id].ts` - Must return Programmaplanning with completion status

## API Changes

### Option 1: Add counts to Program response
```typescript
interface Program {
  // ... existing fields
  totalSessions: number       // Count of Programmaplanning records
  completedSessions: number   // Count with methodUsage > 0
}
```

### Option 2: Return full schedule with status
```typescript
interface ProgramDetail extends Program {
  schedule: Array<{
    id: string
    date: string
    isCompleted: boolean  // methodUsage.length > 0
    methods: Method[]
  }>
}
```

## Relation to Other Specs

| Spec | Relationship |
|------|--------------|
| **method-usage-tracking** | Creates Method Usage → links to Programmaplanning |
| **mental-fitness-programs** | Displays Programmaplanning schedule with completion status |
| **activity-based-progress** | Calculates progress from completed Programmaplanning count |

## Migration Notes

If existing programs were using `weeks × frequency` calculation:
1. Programs with AI-generated schedules have Programmaplanning records
2. Legacy programs without Programmaplanning show 0% until schedule is created
3. Consider adding a migration to generate Programmaplanning for legacy programs
