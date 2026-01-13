# Implementation Plan: Mental Fitness Programs

## Overview

Build a complete programs feature: API endpoints, programs listing page, detail page, and home page enhancements.

## Phase 1: Programs API Layer

Build the backend API to fetch programs data from Airtable.

### Tasks

- [ ] Add PROGRAM_FIELDS, GOAL_FIELDS, METHOD_FIELDS, DAY_FIELDS to field-mappings.js
- [ ] Create `api/programs/index.ts` - GET user's programs
- [ ] Create `api/programs/[id].ts` - GET single program with expanded relations
- [ ] Add `api.programs.*` namespace to frontend API client
- [ ] Create `src/types/program.ts` with TypeScript interfaces

### Technical Details

**Field Mappings (api/_lib/field-mappings.js):**
```javascript
// Programs table field IDs (Mentale Fitnessprogramma's)
export const PROGRAM_FIELDS = {
  id: "fldzeEtEfVRM3qXzp",              // ID (AutoNumber)
  user: "fldDc1mJUjBl2y7Hy",            // Gebruiker (Link)
  startDate: "fldY5UGS0XSd1eUxu",       // Startdatum
  duration: "fld3mrRTtqPX2a1fX",        // Duur van programma
  endDate: "fld2zTiRAKOXTenP4",         // Einddatum Programma (Formula)
  daysOfWeek: "fldC9mH8v5UjLSPVU",      // Dagen van de week (Link)
  frequency: "fldIGX4ZfG9LyYgMt",       // Frequentie per week (Count)
  goals: "fldo1Lc26dqEkUkwU",           // Doelstellingen (Link)
  methods: "fldvcpSF78ATEk12U",         // Mentale methode (Link)
  sessionTime: "fldEWZ3BpI7ueG9ai",     // Tijd per sessie (Rollup)
  notes: "fldAUf1ENHtF8NRPl"            // Notities
}

// Goals table field IDs (Doelstellingen)
export const GOAL_FIELDS = {
  name: "fldgLmhiCydWQgjUi",             // Doelstelling Naam
  description: "fldb1q8hRJyfFglYV",      // Beschrijving
  status: "fldjVOkLDqCsAdvft",           // Status (Actief/Afgerond/Gepland)
  methods: "fldZM72fiIX2SA4Cl",          // Methodes (Link)
  user: "fld7SlWpDzIhxzW5A",             // Gebruiker (Link)
  programs: "fldHVkXMs8gQkpbr5"          // Mentale Fitnessprogramma's (Link)
}

// Methods table field IDs (Methodes)
export const METHOD_FIELDS = {
  name: "fldXP3qNngK3oXEjR",             // Methode Naam
  duration: "fldg3pJ3mtwBTVtd8",         // Duur (minuten)
  description: "fldW7tdp7AJoeKerd",      // Beschrijving
  experienceLevel: "fldKppvap3PVPlMq8",  // Ervaringsniveau
  photo: "fldT64jU7CfcgTe0y",            // Foto
  users: "fldizDnwdWMO7UfSz",            // Gebruikers (Link)
  programs: "fld36JCBhGcXYurrp"          // Mentale Fitnessprogramma's (Link)
}

// Days of Week table field IDs (Dagen van de week)
export const DAY_FIELDS = {
  name: "fldj61ALcQp8OYO1u",             // Name (Maandag, Dinsdag, etc.)
  programs: "fldoml9PLaWNLT59y"          // Mentale Fitnessprogramma's (Link)
}

export const FIELD_NAMES = {
  // ... existing user/company fields ...
  program: {
    user: "Gebruiker",
    startDate: "Startdatum",
    duration: "Duur van programma",
    endDate: "Einddatum Programma",
    daysOfWeek: "Dagen van de week",
    frequency: "Frequentie per week",
    goals: "Doelstellingen",
    methods: "Mentale methode",
    sessionTime: "Tijd per sessie (min)",
    notes: "Notities"
  }
}
```

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

- [ ] Rename Tab1 to "Programs" in BottomNav.tsx
- [ ] Create `src/components/ProgramCard.tsx` component
- [ ] Create `src/pages/ProgramsPage.tsx` with grouped sections
- [ ] Update App.tsx route from /tab1 to /programs
- [ ] Update pages/index.ts exports
- [ ] Delete Tab1Page.tsx

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

- [ ] Create `src/pages/ProgramDetailPage.tsx`
- [ ] Add `/programs/:id` route to App.tsx
- [ ] Fetch and display program with expanded relations
- [ ] Show schedule, goals, and methods sections
- [ ] Add back navigation

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

- [ ] Add running program card to HomePage
- [ ] Add upcoming activity section
- [ ] Calculate next scheduled day
- [ ] Show methods for next session
- [ ] Handle no running program state

### Technical Details

**HomePage additions:**
```typescript
// After welcome section:
// 1. "Current Program" card (if running program exists)
// 2. "Upcoming Activity" card showing:
//    - Next scheduled day (e.g., "Tomorrow - Woensdag")
//    - Methods list
//    - Total time estimate
```

**Next scheduled day calculation:**
```typescript
function getNextScheduledDay(daysOfWeek: string[]): { day: string; isToday: boolean; daysUntil: number } | null {
  const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']
  const today = new Date()
  const todayIndex = today.getDay()

  for (let i = 0; i < 7; i++) {
    const checkIndex = (todayIndex + i) % 7
    const dayName = dayNames[checkIndex]
    if (daysOfWeek.includes(dayName)) {
      return {
        day: dayName,
        isToday: i === 0,
        daysUntil: i
      }
    }
  }
  return null
}
```

**Display logic:**
```typescript
// If daysUntil === 0: "Today"
// If daysUntil === 1: "Tomorrow"
// Otherwise: Day name (e.g., "Vrijdag")
```
