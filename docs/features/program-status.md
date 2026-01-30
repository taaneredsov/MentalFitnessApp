# Program Status Field

Programs can have different statuses based on their lifecycle stage.

## Overview

The Status field tracks whether a program is currently active, scheduled for the future, or completed. This field is automatically set on program creation and helps users understand program state at a glance.

## Status Values

| Status | Dutch Name | Description | When Set |
|--------|------------|-------------|----------|
| Active | Actief | Program is currently running | Start date ≤ today |
| Scheduled | Gepland | Program starts in the future | Start date > today |
| Completed | Afgewerkt | Program has finished | Manually set after completion |

## Airtable Field

- **Table**: Mentale Fitnessprogramma's (Programs)
- **Field ID**: `fldJcgvXDr2LDin14`
- **Field Name**: Status
- **Type**: Single Select
- **Options**: Actief, Gepland, Afgewerkt

## Automatic Status Assignment

When a program is created, the status is automatically determined based on the start date:

```typescript
function getInitialProgramStatus(startDate: string): "Actief" | "Gepland" {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split("T")[0]

  return startDate <= todayStr ? "Actief" : "Gepland"
}
```

### Logic

- **If** `startDate ≤ today` → Status = **Actief**
- **If** `startDate > today` → Status = **Gepland**

## API Implementation

### Program Creation (POST /api/programs)

```typescript
// api/programs/index.ts

const fields: Record<string, unknown> = {
  [PROGRAM_FIELDS.user]: [body.userId],
  [PROGRAM_FIELDS.startDate]: body.startDate,
  [PROGRAM_FIELDS.duration]: body.duration,
  [PROGRAM_FIELDS.status]: getInitialProgramStatus(body.startDate) // Auto-set
}

const record = await base(tables.programs).create(fields, { typecast: true })
```

### Program Confirmation (POST /api/programs/confirm)

When a program is confirmed after AI generation, the status is set:

```typescript
// api/programs/confirm.ts

await base(tables.programs).update(draftProgramId, {
  [PROGRAM_FIELDS.status]: getInitialProgramStatus(body.startDate)
})
```

## Field Mappings

```javascript
// api/_lib/field-mappings.js

export const PROGRAM_FIELDS = {
  // ...other fields
  status: "fldJcgvXDr2LDin14" // Status (Single select: Actief/Gepland/Afgewerkt)
}
```

## Frontend Usage

### Checking Program Status

```typescript
// src/types/program.ts

export function getProgramStatus(program: Program): "running" | "upcoming" | "completed" {
  if (!program.startDate || !program.endDate) return "completed"

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split("T")[0]

  const start = program.startDate
  const end = program.endDate

  if (todayStr < start) return "upcoming"
  if (todayStr > end) return "completed"
  return "running"
}
```

The frontend calculates status dynamically based on dates, but the Airtable Status field provides a persistent record.

### Display Logic

Programs are displayed differently based on status:

```typescript
// HomePage.tsx

const status = getProgramStatus(program)

if (status === "running") {
  // Show active program with next session, progress, etc.
}

if (status === "upcoming") {
  // Show scheduled program with start date
}

if (status === "completed") {
  // Show completion status, final score, review option
}
```

## Status Transitions

```
┌──────────┐
│  Gepland │  (Created with future start date)
└────┬─────┘
     │ startDate arrives
     ▼
┌──────────┐
│  Actief  │  (Program is running)
└────┬─────┘
     │ endDate passes OR user completes all methods
     ▼
┌────────────┐
│ Afgewerkt  │  (Program completed)
└────────────┘
```

### Transition Rules

1. **Gepland → Actief**: Automatically when start date arrives (frontend logic)
2. **Actief → Afgewerkt**: Could be triggered by:
   - End date passing
   - User completing all program methods (manual)
   - User explicitly marking as complete

Currently, the Status field is set on creation but not automatically updated. The frontend relies on date calculations for real-time status.

## Known Considerations

### No Automatic Status Updates

The Status field in Airtable is **not automatically updated** as dates pass. It serves as an initial classification. The frontend calculates the real-time status based on dates.

**Why?**
- Airtable doesn't support automatic date-based updates
- Frontend calculations are more reliable and real-time
- Status field provides useful filtering in Airtable for administrators

### Manual Completion

There is currently no API endpoint to manually mark a program as "Afgewerkt". This could be added in the future:

```typescript
// Future: PATCH /api/programs/:id/complete
await base(tables.programs).update(programId, {
  [PROGRAM_FIELDS.status]: "Afgewerkt"
})
```

## Related Features

- **One Active Program Limit**: Checks if any program is running (based on dates)
- **Program Display**: Uses status to determine UI rendering
- **Program Filtering**: Administrators can filter by Status in Airtable

## Testing

### Create Program with Today's Date
```json
{
  "userId": "recXXX",
  "startDate": "2026-01-30",
  "duration": 30
}
```
**Expected**: Status = "Actief"

### Create Program with Future Date
```json
{
  "userId": "recXXX",
  "startDate": "2026-02-15",
  "duration": 30
}
```
**Expected**: Status = "Gepland"

### Create Program with Past Date
```json
{
  "userId": "recXXX",
  "startDate": "2026-01-01",
  "duration": 30
}
```
**Expected**: Status = "Actief" (even though it should be completed)

Note: The system doesn't prevent creating programs with past dates. Consider adding validation.
