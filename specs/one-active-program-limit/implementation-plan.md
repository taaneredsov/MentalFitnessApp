# Implementation Plan: One Active Program Limit

## Overview

Implement validation to ensure users can only have one active (running) program at a time. This involves frontend UI changes and backend API validation.

## Phase 1: Frontend Validation & UX

Block program creation in the UI when user has a running program, with clear messaging.

### Tasks

- [ ] Add helper function to check if user has running program
- [ ] Block AIProgramWizard access when running program exists
- [ ] Create "Active Program" message component with link to current program
- [ ] Update HomePage to show blocking message instead of wizard

### Technical Details

**File: `src/types/program.ts`**
```typescript
// Add helper function
export function hasRunningProgram(programs: Program[]): boolean {
  return programs.some(p => getProgramStatus(p) === "running")
}

export function getRunningProgram(programs: Program[]): Program | undefined {
  return programs.find(p => getProgramStatus(p) === "running")
}
```

**File: `src/pages/HomePage.tsx`**
- Import `hasRunningProgram`, `getRunningProgram` helpers
- Before showing onboarding wizard, check `hasRunningProgram(programs)`
- If true, show message with link to current program instead of wizard

**UI Message Component:**
```tsx
// Show when user tries to create program but has one running
<Card>
  <CardHeader>
    <CardTitle>Je hebt al een actief programma</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Je kunt slechts één programma tegelijk volgen.</p>
    <p>Voltooi of bewerk je huidige programma eerst.</p>
    <Button onClick={() => navigate(`/programs/${runningProgram.id}`)}>
      Bekijk huidig programma
    </Button>
  </CardContent>
</Card>
```

## Phase 2: Backend API Validation

Add server-side validation to prevent program creation via API.

### Tasks

- [ ] Add validation in program creation endpoint
- [ ] Return appropriate error code and message
- [ ] Handle edge case: planned programs should not block creation

### Technical Details

**File: `api/programs/index.ts` (or equivalent)**

Add validation before creating program:
```typescript
// Check for existing running program
const existingPrograms = await base(tables.programs)
  .select({
    filterByFormula: `{${FIELD_NAMES.program.user}} = "${userId}"`,
    returnFieldsByFieldId: true
  })
  .all()

const hasRunning = existingPrograms.some(p => {
  const startDate = p.fields[PROGRAM_FIELDS.startDate]
  const endDate = p.fields[PROGRAM_FIELDS.endDate]
  const today = new Date().toISOString().split('T')[0]
  return startDate <= today && endDate >= today
})

if (hasRunning) {
  return sendError(res, "Je hebt al een actief programma. Voltooi dit eerst.", 409)
}
```

**HTTP Status Code**: 409 Conflict (appropriate for business rule violation)

## Phase 3: Edge Cases & Polish

Handle edge cases and improve user experience.

### Tasks

- [ ] Handle race condition: check again before final commit
- [ ] Add loading state while checking for existing programs
- [ ] Ensure "Edit Program" flow is not blocked (separate from create)

### Technical Details

**Race Condition Handling:**
- Use transaction or double-check pattern
- Frontend disables button immediately on click
- Backend validates right before insert

**Loading State:**
- Show skeleton/spinner while `usePrograms` is loading
- Don't show wizard or blocking message until data is loaded

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/program.ts` | Add `hasRunningProgram()`, `getRunningProgram()` helpers |
| `src/pages/HomePage.tsx` | Check for running program before showing wizard |
| `api/programs/index.ts` | Add validation in POST handler |

## Testing Checklist

- [ ] User with running program sees blocking message
- [ ] User with only planned programs can create new program
- [ ] User with only finished programs can create new program
- [ ] API returns 409 when trying to create with running program
- [ ] Link to current program works correctly
