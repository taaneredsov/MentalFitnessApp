# Implementation Plan: Mental Fitness Programs

## Overview

Build a complete programs feature: API endpoints, programs listing page, detail page, and home page enhancements.

## Phase 1: Programs API Layer

Build the backend API to fetch programs data from Postgres.

### Tasks

- [x] Add PROGRAM_FIELDS, GOAL_FIELDS, METHOD_FIELDS, DAY_FIELDS to field-mappings.js
- [x] Create `api/programs/index.ts` - GET user's programs
- [x] Create `api/programs/[id].ts` - GET single program with expanded relations
- [x] Add `api.programs.*` namespace to frontend API client
- [x] Create `src/types/program.ts` with TypeScript interfaces

### Technical Details

**Architecture**: All program reads come from Postgres. Writes go to Postgres first, then sync to Airtable via the outbox pattern.

**API Endpoint - GET /api/programs (api/programs/index.ts):**
```typescript
// Returns all programs for authenticated user
// Query params: ?userId=recXXX
// Response: { success: true, data: Program[] }
```

**API Endpoint - GET /api/programs/[id] (api/programs/[id].ts):**
```typescript
// Returns single program with expanded relations
// Response: { success: true, data: ProgramDetail }
// Includes: goals[], methods[], daysOfWeek[]
```

**TypeScript Types (src/types/program.ts):**
```typescript
export interface Program {
  id: string
  startDate: string
  endDate: string
  duration: string
  daysOfWeek: string[]
  frequency: number
  goals: string[]      // record IDs
  methods: string[]    // record IDs
  sessionTime: number
  notes?: string
}

export interface ProgramDetail extends Program {
  goalDetails: Goal[]
  methodDetails: Method[]
  dayNames: string[]
}

export interface Goal {
  id: string
  name: string
  description?: string
  status: 'Actief' | 'Afgerond' | 'Gepland'
}

export interface Method {
  id: string
  name: string
  duration: number
  description?: string
  photo?: string
}

export type ProgramStatus = 'planned' | 'running' | 'finished'
```

**API Client (src/lib/api-client.ts):**
```typescript
programs: {
  list: (userId: string) =>
    request<Program[]>(`/programs?userId=${userId}`),

  get: (id: string) =>
    request<ProgramDetail>(`/programs/${id}`)
}
```

## Phase 2: Programs Overview (Tab1)

Transform Tab1 into a Programs listing page.

### Tasks

- [x] Rename Tab1 to "Programs" in BottomNav.tsx
- [x] Create `src/components/ProgramCard.tsx` component
- [x] Create `src/pages/ProgramsPage.tsx` with grouped sections
- [x] Update App.tsx route from /tab1 to /programs
- [x] Update pages/index.ts exports
- [x] Delete Tab1Page.tsx

### Technical Details

**BottomNav update:**
```typescript
const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/programs", icon: Calendar, label: "Programs" },
  { path: "/tab2", icon: BookOpen, label: "Tab 2" },
  { path: "/account", icon: User, label: "Account" }
]
```

**ProgramCard component (src/components/ProgramCard.tsx):**
```typescript
interface ProgramCardProps {
  program: Program
  status: ProgramStatus
  onClick: () => void
}

// Shows: dates, frequency, progress bar (for running), status badge
```

**ProgramsPage structure:**
```typescript
// Sections:
// 1. Running Programs (status === 'running')
// 2. Planned Programs (status === 'planned')
// 3. Finished Programs (status === 'finished')

// Each section: heading + list of ProgramCards
// Empty state when no programs in section
```

**Status calculation:**
```typescript
function getProgramStatus(program: Program): ProgramStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = new Date(program.startDate)
  const end = new Date(program.endDate)

  if (today < start) return 'planned'
  if (today > end) return 'finished'
  return 'running'
}
```

## Phase 3: Program Detail Page

Create a detail view for individual programs.

### Tasks

- [x] Create `src/pages/ProgramDetailPage.tsx`
- [x] Add `/programs/:id` route to App.tsx
- [x] Fetch and display program with expanded relations
- [x] Show schedule, goals, and methods sections
- [x] Add back navigation

### Technical Details

**Route addition (App.tsx):**
```typescript
<Route path="/programs/:id" element={<ProgramDetailPage />} />
```

**ProgramDetailPage structure:**
```typescript
// Header: Back button + Program title
// Info section: Dates, duration, frequency, session time
// Schedule section: Days of week chips
// Goals section: List of goal cards with status
// Methods section: List of method cards with duration
```

**Data fetching:**
```typescript
const { id } = useParams()
const [program, setProgram] = useState<ProgramDetail | null>(null)

useEffect(() => {
  api.programs.get(id).then(setProgram)
}, [id])
```

## Phase 4: Home Page Enhancement

Add running program and upcoming activity to Home page.

### Tasks

- [x] Add running program card to HomePage
- [x] Add upcoming activity section
- [x] Calculate next open session
- [x] Show methods for next open session
- [x] Handle no running program state

### Technical Details

**HomePage additions:**
```typescript
// After welcome section:
// 1. "Current Program" card (if running program exists)
// 2. "Upcoming Activity" card showing:
//    - Next open session day label (Vandaag/Morgen/weekday)
//    - Methods list
//    - Total time estimate
```

**Next open session calculation:**
```typescript
function getNextOpenSession(schedule: Programmaplanning[]): Programmaplanning | null {
  // 1) today's open session first
  // 2) otherwise first future open session
  // open = completedMethodIds.length < methodIds.length
}
```

**Display logic:**
```typescript
// If next session is today: "Vandaag"
// If next session is tomorrow: "Morgen"
// Otherwise: weekday label
// If no next open session: do not show "Volgende Activiteit"
```

## Phase 5: Ended Program UX + Extend Flow

Fix edge case where Home still shows stale upcoming-day behavior while there is no real next open session.

### Tasks

- [x] Replace weekday fallback logic with real next-open-session lookup from schedule records
- [x] Add Home top-card fallback state when no next open activity exists
- [x] Add actions on fallback state:
  - [x] Primary: `Programma verlengen` (only when incomplete)
  - [x] Secondary: `Maak nieuw programma`
- [x] Add ended-complete state with `Maak nieuw programma`
- [x] Implement extend API flow (`POST /api/programs/:id/extend`)
- [x] Add extension picker with options `2 / 4 / 6 weken`
- [ ] Add analytics/log events for `program_extend_started`, `program_extend_completed`, `program_new_started_from_ended`

### Technical Details

**Home state decision order:**
```typescript
// 1) Show next activity only when a real open session exists
const nextSession = getNextOpenSession(schedule, today)

// 2) If no next open session:
//    - if incomplete => show fallback with extend CTA
//    - if complete => show completion fallback without extend
//    - title "Programma afgelopen" if endedByDate else "Geen volgende activiteit"
```

**Files updated:**
- `src/pages/HomePage.tsx`
- `src/components/ProgramExtendDialog.tsx` (new)
- `src/lib/api-client.ts` (`programs.extend`)
- `src/hooks/queries.ts` (`useExtendProgram`)
- `api/programs/[id]/extend.ts` (new endpoint)
- `server.ts` (route registration)

**Extend behavior:**
1. Keep completed historical sessions untouched.
2. Recalculate extension schedule from `extensionStart = max(today, oldEndDate + 1 day)`.
3. `newEndDate = extensionStart + selectedWeeks * 7 - 1`.
4. Update program `duration`/`endDate` consistently.
5. Return refreshed program detail + schedule counts.

### Validation Checklist

- [x] Program ended on `2026-02-13` with incomplete sessions: no fake weekday fallback
- [x] No-next-open-session case shows fallback card
- [x] Clicking `Programma verlengen` opens selector (`2/4/6 weken`)
- [x] Confirm extend generates new future sessions and restores next activity when applicable
- [x] Clicking `Maak nieuw programma` opens existing creation flow
- [x] Fully completed program shows no extend CTA
