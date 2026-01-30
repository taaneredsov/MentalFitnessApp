# One Active Program Limit

Users can only have one active (running) program at a time. This ensures focus and prevents confusion.

## Overview

When a user tries to create a new program while already having an active program, the system blocks the creation with a clear error message. This limitation encourages program completion before starting a new one.

## Business Rules

### What Counts as "Active"?

A program is considered active if:
```typescript
startDate <= today AND endDate >= today
```

Only programs with dates spanning today count as active.

### What's Allowed?

- ✅ Create a scheduled (future) program while having an active one
- ✅ Create a new program after the current one ends
- ✅ Have multiple completed programs
- ✅ Have multiple scheduled programs
- ❌ Create a new program that starts today while one is running

## Backend Implementation

### API Endpoint

**POST /api/programs** - Validates before creating a program

### Validation Logic

```typescript
// api/programs/index.ts

function isProgramRunning(startDate: string, endDate: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split("T")[0]

  return startDate <= todayStr && endDate >= todayStr
}

// Check for existing running program
const existingRecords = await base(tables.programs)
  .select({ returnFieldsByFieldId: true })
  .all()

const userRunningProgram = existingRecords.find(record => {
  const userIds = record.fields[PROGRAM_FIELDS.user] as string[] | undefined
  if (!userIds?.includes(body.userId)) return false

  const startDate = record.fields[PROGRAM_FIELDS.startDate] as string | undefined
  const endDate = record.fields[PROGRAM_FIELDS.endDate] as string | undefined
  if (!startDate || !endDate) return false

  return isProgramRunning(startDate, endDate)
})

if (userRunningProgram) {
  return sendError(
    res,
    "Je hebt al een actief programma. Voltooi dit eerst voordat je een nieuw programma start.",
    409
  )
}
```

### Error Response

**Status Code**: 409 Conflict

```json
{
  "success": false,
  "error": "Je hebt al een actief programma. Voltooi dit eerst voordat je een nieuw programma start."
}
```

## Frontend Implementation

### Location

- **File**: `src/pages/HomePage.tsx`

### UI Blocking

When a user has an active program, the "Create Program" button is hidden and replaced with a blocking message:

```typescript
const runningProgram = useMemo(
  () => programs.find(p => getProgramStatus(p) === "running"),
  [programs]
)

{runningProgram ? (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-lg">Je hebt al een actief programma</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-muted-foreground">
        Je kunt slechts één programma tegelijk volgen. Voltooi je huidige programma
        om een nieuw te kunnen starten.
      </p>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {/* scroll to active program */}}
      >
        Bekijk actief programma
      </Button>
    </CardContent>
  </Card>
) : (
  <Button onClick={() => setShowOnboarding(true)}>
    <Sparkles className="h-5 w-5 mr-2" />
    Nieuw programma opstellen
  </Button>
)}
```

### User Experience

1. **With Active Program**:
   - "Create Program" button is hidden
   - Blocking message explains limitation
   - "View Active Program" button scrolls to program details

2. **Without Active Program**:
   - "Create Program" button is visible
   - AI Program Wizard can be launched
   - User can start the onboarding flow

3. **With Scheduled Program**:
   - "Create Program" button is visible (scheduled doesn't block)
   - User can create multiple future programs

## Helper Functions

### Frontend Status Check

```typescript
// src/types/program.ts

export function hasRunningProgram(programs: Program[]): boolean {
  return programs.some(p => getProgramStatus(p) === "running")
}

export function getRunningProgram(programs: Program[]): Program | undefined {
  return programs.find(p => getProgramStatus(p) === "running")
}

export function getProgramStatus(program: Program): "running" | "upcoming" | "completed" {
  if (!program.startDate || !program.endDate) return "completed"

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split("T")[0]

  if (todayStr < program.startDate) return "upcoming"
  if (todayStr > program.endDate) return "completed"
  return "running"
}
```

## Edge Cases

### Program Ending Today

If a program's `endDate` is today:
- It's still considered "running" (dates are inclusive)
- User cannot create a new program starting today
- User can create a program starting tomorrow

### Multiple Programs with Overlapping Dates

The system only checks for ONE running program. If somehow a user has multiple programs with overlapping dates (e.g., manual Airtable entry), the validation still works correctly by checking if ANY program is running.

### Scheduled Programs

Scheduled programs (startDate > today) do NOT count toward the limit:
- User can have multiple scheduled programs
- User can create a scheduled program while having an active one
- Only one program can be "active" at any given time

## Error Handling

### Backend Error

If program creation fails due to active program:
```typescript
try {
  await createProgram(data)
} catch (error) {
  if (error.message.includes("actief programma")) {
    // Show friendly error message
    toast.error("Je hebt al een actief programma")
  }
}
```

### Frontend Validation

The frontend prevents the API call by hiding the create button, but backend validation is the source of truth.

## Testing Scenarios

### Scenario 1: Create While Active
1. User has program: Jan 15 - Feb 15 (today is Jan 30)
2. User tries to create new program starting Jan 30
3. **Result**: Blocked with 409 error

### Scenario 2: Create After Completion
1. User has program: Jan 1 - Jan 28 (today is Jan 30)
2. User tries to create new program starting Jan 30
3. **Result**: Success ✅

### Scenario 3: Create Scheduled While Active
1. User has program: Jan 15 - Feb 15 (today is Jan 30)
2. User tries to create new program starting Feb 20
3. **Result**: Success ✅ (scheduled programs allowed)

### Scenario 4: Natural Transition
1. User has program: Jan 15 - Feb 15
2. Today is Feb 15 (last day)
3. Program automatically becomes "completed" tomorrow
4. User can create new program starting Feb 16

## Related Features

- **Program Status**: Uses Status field to classify programs
- **AI Program Wizard**: Respects one-active-program limit before generation
- **Program Display**: Shows active program prominently on home page

## Future Enhancements

Potential improvements:
- Allow explicit program completion before end date
- Show countdown to when new program can be created
- Allow "replacing" a program (archive old, start new)
- Multi-program support with toggle (opt-in feature)
