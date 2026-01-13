# Implementation Plan: Program Creation & Onboarding

## Overview

Build a multi-step wizard for creating mental fitness programs. The wizard will be used for onboarding new users and for creating additional programs from the Programma's tab.

## Phase 1: API Endpoints

Create the necessary API endpoints to fetch reference data and create programs.

### Tasks

- [x] Create GET `/api/goals` endpoint to fetch all goals from Doelstellingen table
- [x] Create GET `/api/days` endpoint to fetch all days from Dagen van de week table
- [x] Create POST `/api/programs` endpoint to create a new program
- [x] Create GET `/api/programs/:id/methods` endpoint to poll for auto-suggested methods

### Technical Details

**File: `api/goals/index.ts`**
```typescript
// GET /api/goals - Fetch all goals
export default async function handler(req, res) {
  const records = await base(tables.goals)
    .select({ returnFieldsByFieldId: true })
    .all()
  const goals = records.map(r => transformGoal(r))
  return sendSuccess(res, goals)
}
```

**File: `api/days/index.ts`**
```typescript
// GET /api/days - Fetch all days of the week
export default async function handler(req, res) {
  const records = await base(tables.daysOfWeek)
    .select({ returnFieldsByFieldId: true })
    .all()
  const days = records.map(r => transformDay(r))
  return sendSuccess(res, days)
}
```

**File: `api/programs/index.ts`** (add POST handler)
```typescript
// POST /api/programs - Create a new program
const createSchema = z.object({
  userId: z.string(),
  startDate: z.string(),
  duration: z.string(),
  goals: z.array(z.string()).optional(),
  daysOfWeek: z.array(z.string()),
  methods: z.array(z.string()).optional(),
  notes: z.string().optional()
})
```

**Field IDs for Program Creation:**
```javascript
const fields = {
  [PROGRAM_FIELDS.user]: [body.userId],
  [PROGRAM_FIELDS.startDate]: body.startDate,
  [PROGRAM_FIELDS.duration]: body.duration,
  [PROGRAM_FIELDS.goals]: body.goals || [],
  [PROGRAM_FIELDS.daysOfWeek]: body.daysOfWeek,
  [PROGRAM_FIELDS.methods]: body.methods || [],
  [PROGRAM_FIELDS.notes]: body.notes
}
```

**Tables:**
- Goals: `tbl6ngkyNrv0LFzGb`
- Days of Week: `tblS3gleG8cSlWOJ3`
- Programs: `tblqW4xeCx1tprNgX`

## Phase 2: API Client & Types

Update the frontend API client and types to support program creation.

### Tasks

- [x] Add `Goal` type to `src/types/program.ts` (if not complete)
- [x] Add `Day` type to `src/types/program.ts`
- [x] Add `api.goals.list()` to api-client
- [x] Add `api.days.list()` to api-client
- [x] Add `api.programs.create()` to api-client
- [x] Add `api.programs.getMethods()` to api-client for polling

### Technical Details

**File: `src/types/program.ts`**
```typescript
export interface Day {
  id: string
  name: string  // Maandag, Dinsdag, etc.
}

// Goal interface already exists, verify it has id, name, description
```

**File: `src/lib/api-client.ts`**
```typescript
goals: {
  list: () => request<Goal[]>("/goals")
},

days: {
  list: () => request<Day[]>("/days")
},

programs: {
  // existing: list, get
  create: (data: CreateProgramData, accessToken: string) =>
    request<Program>("/programs", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(data)
    }),
  getMethods: (id: string) =>
    request<string[]>(`/programs/${id}/methods`)
}
```

**CreateProgramData type:**
```typescript
interface CreateProgramData {
  userId: string
  startDate: string
  duration: string
  goals?: string[]
  daysOfWeek: string[]
  methods?: string[]
  notes?: string
}
```

## Phase 3: Program Creation Wizard Component [complex]

Build the multi-step wizard UI for program creation.

### Tasks

- [x] Create `ProgramWizard` component with step navigation
- [x] Create Step 1: BasicInfoStep (start date, duration)
- [x] Create Step 2: GoalsStep (multi-select goals)
- [x] Create Step 3: ScheduleStep (days of week selection)
- [x] Create Step 4: MethodsStep (view/edit suggested methods)
- [x] Create Step 5: ConfirmationStep (review and save)
- [x] Add wizard state management (useReducer or useState)
- [x] Implement polling logic for auto-suggested methods

### Technical Details

**File: `src/components/ProgramWizard/index.tsx`**
```typescript
interface WizardState {
  step: number
  startDate: string
  duration: string
  goals: string[]
  daysOfWeek: string[]
  methods: string[]
  notes: string
  programId?: string  // Set after initial save
  isPolling: boolean
}

const STEPS = [
  { title: "Basis", component: BasicInfoStep },
  { title: "Doelen", component: GoalsStep },
  { title: "Schema", component: ScheduleStep },
  { title: "Methodes", component: MethodsStep },
  { title: "Bevestig", component: ConfirmationStep }
]
```

**Duration options:**
```typescript
const DURATION_OPTIONS = [
  { value: "1 week", label: "1 week" },
  { value: "2 weken", label: "2 weken" },
  { value: "3 weken", label: "3 weken" },
  { value: "4 weken", label: "4 weken" },
  { value: "6 weken", label: "6 weken" },
  { value: "8 weken", label: "8 weken" }
]
```

**Polling for methods (after step 3):**
```typescript
// Save program without methods after step 3
// Then poll for Airtable automation to populate methods
const pollForMethods = async (programId: string, maxAttempts = 10) => {
  for (let i = 0; i < maxAttempts; i++) {
    const methods = await api.programs.getMethods(programId)
    if (methods.length > 0) return methods
    await new Promise(r => setTimeout(r, 3000)) // 3s interval
  }
  return [] // Timeout, no methods suggested
}
```

**UI Components needed:**
- Date picker (use existing or add new)
- Select/Dropdown for duration
- Multi-select for goals
- Checkbox group for days
- Method cards with add/remove

## Phase 4: Onboarding Integration

Integrate the wizard into the onboarding flow for new users.

### Tasks

- [x] Add logic to HomePage to detect first-time users (no programs)
- [x] Show onboarding wizard when user has no programs
- [x] Add welcome message before wizard starts
- [x] Redirect to program detail after completion

### Technical Details

**File: `src/pages/HomePage.tsx`**
```typescript
// In the useEffect that fetches running program
const programs = await api.programs.list(user.id)
if (programs.length === 0) {
  setShowOnboarding(true)
}
```

**Onboarding entry:**
```typescript
{showOnboarding && (
  <ProgramWizard
    mode="onboarding"
    onComplete={(programId) => {
      setShowOnboarding(false)
      navigate(`/programs/${programId}`)
    }}
  />
)}
```

## Phase 5: Programs Page Integration

Add "Nieuw Programma" button to the Programs page.

### Tasks

- [x] Add "Nieuw Programma" button to ProgramsPage header
- [x] Open wizard as modal or navigate to wizard page
- [x] Refresh program list after creation
- [x] Handle wizard cancellation

### Technical Details

**File: `src/pages/ProgramsPage.tsx`**
```typescript
const [showWizard, setShowWizard] = useState(false)

// In header:
<Button onClick={() => setShowWizard(true)}>
  <Plus className="h-4 w-4 mr-2" />
  Nieuw Programma
</Button>

// Wizard modal:
{showWizard && (
  <Dialog open={showWizard} onOpenChange={setShowWizard}>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <ProgramWizard
        mode="create"
        onComplete={(programId) => {
          setShowWizard(false)
          navigate(`/programs/${programId}`)
        }}
        onCancel={() => setShowWizard(false)}
      />
    </DialogContent>
  </Dialog>
)}
```

## Phase 6: Polish & Edge Cases

Handle edge cases and improve UX.

### Tasks

- [x] Add loading states for each step's data fetching
- [x] Add error handling for API failures
- [x] Handle Airtable automation timeout (show manual method selection)
- [x] Add form validation for required fields
- [x] Add step progress indicator
- [x] Make wizard mobile-responsive

### Technical Details

**Timeout handling:**
```typescript
if (pollAttempts >= maxAttempts) {
  setError("Methodes konden niet automatisch worden geladen")
  setShowManualMethodSelection(true)
}
```

**Validation:**
```typescript
const canProceed = {
  1: state.startDate && state.duration,
  2: true, // Goals optional
  3: state.daysOfWeek.length > 0,
  4: true, // Methods can be empty
  5: true
}
```

## Summary of New Files

| File | Purpose |
|------|---------|
| `api/goals/index.ts` | GET endpoint for goals |
| `api/days/index.ts` | GET endpoint for days |
| `api/programs/index.ts` | Add POST handler |
| `api/programs/[id]/methods.ts` | GET endpoint for program methods |
| `src/components/ProgramWizard/index.tsx` | Main wizard component |
| `src/components/ProgramWizard/BasicInfoStep.tsx` | Step 1 |
| `src/components/ProgramWizard/GoalsStep.tsx` | Step 2 |
| `src/components/ProgramWizard/ScheduleStep.tsx` | Step 3 |
| `src/components/ProgramWizard/MethodsStep.tsx` | Step 4 |
| `src/components/ProgramWizard/ConfirmationStep.tsx` | Step 5 |

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/goals` | List all goals |
| GET | `/api/days` | List all days of week |
| POST | `/api/programs` | Create new program |
| GET | `/api/programs/:id/methods` | Get program's methods (for polling) |
