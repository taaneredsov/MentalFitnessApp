# Implementation Plan: Overtuigingen (Beliefs / Mindset)

## Overview

Add a complete "Overtuigingen" feature with browse page, program wizard integration, practice components, and rewards. Implementation follows the existing codebase patterns (field-mappings → API endpoints → React Query hooks → UI components).

## Phase 1: Field Mappings & Types [NO RISK]

Add all Airtable configuration. Zero impact on existing functionality.

### Tasks

- [ ] Add table IDs to `TABLES` in `api/_lib/field-mappings.js`
- [ ] Add field constants: `OVERTUIGING_FIELDS`, `MINDSET_CATEGORY_FIELDS`, `PERSOONLIJKE_OVERTUIGING_FIELDS`, `OVERTUIGING_USAGE_FIELDS`
- [ ] Add `overtuigingen` field to `PROGRAM_FIELDS`
- [ ] Add transform functions: `transformOvertuiging()`, `transformMindsetCategory()`, `transformPersoonlijkeOvertuiging()`, `transformOvertuigingUsage()`
- [ ] Add entries to `FIELD_NAMES` for formula usage
- [ ] Add TypeScript interfaces to `src/types/program.ts`: `Overtuiging`, `MindsetCategory`, `PersoonlijkeOvertuiging`, `OvertuigingUsage`
- [ ] Add `overtuigingen?: string[]` to `Program` interface
- [ ] Add query keys to `src/lib/query-keys.ts`

### Technical Details

**File: `api/_lib/field-mappings.js`**

Add to `TABLES` (line ~55, after personalGoalUsage):
```js
// Overtuigingen tables
overtuigingen: process.env.AIRTABLE_TABLE_OVERTUIGINGEN || "tblXXX",
mindsetCategories: process.env.AIRTABLE_TABLE_MINDSET_CATEGORIES || "tblXXX",
persoonlijkeOvertuigingen: process.env.AIRTABLE_TABLE_PERSOONLIJKE_OVERTUIGINGEN || "tblXXX",
overtuigingenGebruik: process.env.AIRTABLE_TABLE_OVERTUIGINGEN_GEBRUIK || "tblXXX"
```

Field constants (replace `fldXXX` with real IDs from Airtable Meta API):
```js
export const OVERTUIGING_FIELDS = {
  name: "fldXXX",              // Naam (single line text)
  description: "fldXXX",      // Beschrijving (multiline text)
  category: "fldXXX",         // Mindset Categorie (link)
  order: "fldXXX",            // Volgorde (number)
  programs: "fldXXX"          // Mentale Fitnessprogramma's (link)
}

export const MINDSET_CATEGORY_FIELDS = {
  name: "fldXXX",             // Naam (single line text)
  description: "fldXXX",      // Beschrijving (multiline text)
  overtuigingen: "fldXXX",    // Overtuigingen (link)
  goals: "fldXXX"             // Doelstellingen (link)
}

export const PERSOONLIJKE_OVERTUIGING_FIELDS = {
  name: "fldXXX",             // Naam (single line text)
  user: "fldXXX",             // Gebruikers (link to Users)
  program: "fldXXX",          // Programma (link to Programs)
  status: "fldXXX",           // Status (single select: Actief/Afgerond)
  completedDate: "fldXXX",    // Datum afgerond (date)
  createdAt: "fldXXX"         // Aangemaakt op (created time)
}

export const OVERTUIGING_USAGE_FIELDS = {
  user: "fldXXX",             // Gebruikers (link to Users)
  overtuiging: "fldXXX",      // Overtuiging (link to Overtuigingen)
  program: "fldXXX",          // Programma (link to Programs)
  level: "fldXXX",            // Niveau (single select: Niveau 1/2/3)
  date: "fldXXX"              // Datum (date)
}
```

Add to `PROGRAM_FIELDS` (line ~113):
```js
overtuigingen: "fldXXX"  // Overtuigingen (Link)
```

Transform functions (follow existing patterns):
```js
export function transformOvertuiging(record) {
  const fields = record.fields
  return {
    id: record.id,
    name: fields[OVERTUIGING_FIELDS.name],
    description: fields[OVERTUIGING_FIELDS.description],
    categoryIds: fields[OVERTUIGING_FIELDS.category] || [],
    order: fields[OVERTUIGING_FIELDS.order] || 0
  }
}

export function transformMindsetCategory(record) {
  const fields = record.fields
  return {
    id: record.id,
    name: fields[MINDSET_CATEGORY_FIELDS.name],
    description: fields[MINDSET_CATEGORY_FIELDS.description],
    overtuigingIds: fields[MINDSET_CATEGORY_FIELDS.overtuigingen] || [],
    goalIds: fields[MINDSET_CATEGORY_FIELDS.goals] || []
  }
}

export function transformPersoonlijkeOvertuiging(record) {
  const fields = record.fields
  return {
    id: record.id,
    name: fields[PERSOONLIJKE_OVERTUIGING_FIELDS.name],
    userId: fields[PERSOONLIJKE_OVERTUIGING_FIELDS.user]?.[0],
    programId: fields[PERSOONLIJKE_OVERTUIGING_FIELDS.program]?.[0],
    status: fields[PERSOONLIJKE_OVERTUIGING_FIELDS.status] || "Actief",
    completedDate: fields[PERSOONLIJKE_OVERTUIGING_FIELDS.completedDate],
    createdAt: fields[PERSOONLIJKE_OVERTUIGING_FIELDS.createdAt]
  }
}

export function transformOvertuigingUsage(record) {
  const fields = record.fields
  return {
    id: record.id,
    userId: fields[OVERTUIGING_USAGE_FIELDS.user]?.[0],
    overtuigingId: fields[OVERTUIGING_USAGE_FIELDS.overtuiging]?.[0],
    programId: fields[OVERTUIGING_USAGE_FIELDS.program]?.[0],
    level: fields[OVERTUIGING_USAGE_FIELDS.level],
    date: fields[OVERTUIGING_USAGE_FIELDS.date]
  }
}
```

Add to `FIELD_NAMES`:
```js
overtuiging: {
  name: "Naam",
  description: "Beschrijving",
  category: "Mindset Categorie",
  order: "Volgorde"
},
mindsetCategory: {
  name: "Naam",
  description: "Beschrijving",
  overtuigingen: "Overtuigingen",
  goals: "Doelstellingen"
},
persoonlijkeOvertuiging: {
  name: "Naam",
  user: "Gebruikers",
  program: "Programma",
  status: "Status",
  completedDate: "Datum afgerond"
},
overtuigingUsage: {
  user: "Gebruikers",
  overtuiging: "Overtuiging",
  program: "Programma",
  level: "Niveau",
  date: "Datum"
}
```

Add to `transformProgram()` return object:
```js
overtuigingen: fields[PROGRAM_FIELDS.overtuigingen] || []
```

**File: `src/types/program.ts`**

```ts
export interface Overtuiging {
  id: string
  name: string
  description?: string
  categoryIds: string[]
  order: number
}

export interface MindsetCategory {
  id: string
  name: string
  description?: string
  overtuigingIds: string[]
  goalIds: string[]
}

export interface PersoonlijkeOvertuiging {
  id: string
  name: string
  userId: string
  programId?: string
  status: "Actief" | "Afgerond"
  completedDate?: string
  createdAt?: string
}

export interface CreatePersoonlijkeOvertuigingData {
  name: string
  programId?: string
}

export interface UpdatePersoonlijkeOvertuigingData {
  name?: string
  status?: "Actief" | "Afgerond"
}

export interface OvertuigingUsage {
  id: string
  userId?: string
  overtuigingId?: string
  programId?: string
  level?: string  // "Niveau 1", "Niveau 2", "Niveau 3"
  date?: string
}
```

Add to `Program` interface:
```ts
overtuigingen?: string[]  // Linked Overtuiging record IDs
```

**File: `src/lib/query-keys.ts`**

```ts
// Overtuigingen - long cache (30 minutes)
overtuigingen: ["overtuigingen"] as const,
mindsetCategories: ["mindsetCategories"] as const,
overtuigingenByGoals: (goalIds: string[]) => ["overtuigingen", "byGoals", ...goalIds.sort()] as const,

// Overtuiging usage - short cache (1 minute)
overtuigingUsage: (programId: string) => ["overtuigingUsage", programId] as const,

// Personal overtuigingen - medium cache (5 minutes)
persoonlijkeOvertuigingen: (userId: string) => ["persoonlijkeOvertuigingen", userId] as const,
```

---

## Phase 2: Read-Only API Endpoints [LOW RISK]

New files only. No existing code changes except route registration.

### Tasks

- [ ] Create `api/overtuigingen/index.ts` — GET all overtuigingen (cached 30min)
- [ ] Create `api/mindset-categories/index.ts` — GET all mindset categories (cached 30min)
- [ ] Create `api/overtuigingen/by-goals.ts` — GET overtuigingen filtered by goal IDs (auth required)
- [ ] Register 3 new GET routes in `server.ts`
- [ ] Add API client methods: `overtuigingen.list()`, `overtuigingen.byGoals()`, `mindsetCategories.list()`
- [ ] Add React Query hooks: `useOvertuigingen()`, `useMindsetCategories()`, `useOvertuigingsByGoals()`

### Technical Details

**File: `api/overtuigingen/index.ts`** (pattern: `api/goals/index.ts`)
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { sendSuccess, handleApiError } from "../_lib/api-utils.js"
import { transformOvertuiging } from "../_lib/field-mappings.js"
import { cachedSelect } from "../_lib/cached-airtable.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }
  try {
    const overtuigingen = await cachedSelect(
      "overtuigingen",
      {},
      (records) => records.map(r => transformOvertuiging(r as any))
    )
    return sendSuccess(res, overtuigingen)
  } catch (error) {
    return handleApiError(res, error)
  }
}
```

**File: `api/mindset-categories/index.ts`** (same pattern)

**File: `api/overtuigingen/by-goals.ts`** — Auth required. Accepts `?goalIds=id1,id2`. Uses mindset categories to find overtuigingen linked to those goals:
1. Fetch all mindset categories
2. Filter categories where `goalIds` intersects with the query goalIds
3. Collect all `overtuigingIds` from matching categories
4. Fetch those overtuigingen records
5. Return sorted by `order` field

**File: `server.ts`** — Add after personal goal usage routes (~line 193):
```ts
// Overtuigingen routes (read-only)
const { default: overtuigingenHandler } = await import("./api/overtuigingen/index.js")
const { default: overtuigingenByGoalsHandler } = await import("./api/overtuigingen/by-goals.js")
const { default: mindsetCategoriesHandler } = await import("./api/mindset-categories/index.js")

app.get("/api/overtuigingen", wrapVercelHandler(overtuigingenHandler))
app.get("/api/overtuigingen/by-goals", wrapVercelHandler(overtuigingenByGoalsHandler))
app.get("/api/mindset-categories", wrapVercelHandler(mindsetCategoriesHandler))
```

**File: `src/lib/api-client.ts`** — Add to `api` object:
```ts
overtuigingen: {
  list: () => request<Overtuiging[]>("/overtuigingen"),
  byGoals: (goalIds: string[], accessToken: string) =>
    request<Overtuiging[]>(`/overtuigingen/by-goals?goalIds=${goalIds.join(",")}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
},
mindsetCategories: {
  list: () => request<MindsetCategory[]>("/mindset-categories")
},
```

**File: `src/hooks/queries.ts`** — Add hooks:
```ts
export function useOvertuigingen() {
  return useQuery({
    queryKey: queryKeys.overtuigingen,
    queryFn: () => api.overtuigingen.list(),
    staleTime: CACHE_LONG
  })
}

export function useMindsetCategories() {
  return useQuery({
    queryKey: queryKeys.mindsetCategories,
    queryFn: () => api.mindsetCategories.list(),
    staleTime: CACHE_LONG
  })
}

export function useOvertuigingsByGoals(goalIds: string[]) {
  const { accessToken } = useAuth()
  return useQuery({
    queryKey: queryKeys.overtuigingenByGoals(goalIds),
    queryFn: () => api.overtuigingen.byGoals(goalIds, accessToken!),
    enabled: goalIds.length > 0 && !!accessToken,
    staleTime: CACHE_LONG
  })
}
```

---

## Phase 3: Write API Endpoints [LOW-MEDIUM RISK]

New tables only. Minimal existing file changes.

### Tasks

- [ ] Create `api/overtuiging-usage/index.ts` — GET/POST overtuiging usage (validates sequential levels)
- [ ] Create `api/persoonlijke-overtuigingen/index.ts` — GET/POST personal overtuigingen
- [ ] Create `api/persoonlijke-overtuigingen/[id].ts` — PATCH/DELETE personal overtuigingen
- [ ] Add `overtuigingen` to PATCH allowed fields in `api/programs/[id].ts` (1 line)
- [ ] Register write routes in `server.ts`
- [ ] Add API client methods: `overtuigingUsage.*`, `persoonlijkeOvertuigingen.*`
- [ ] Add mutation hooks in `src/hooks/queries.ts`

### Technical Details

**File: `api/overtuiging-usage/index.ts`** (pattern: `api/personal-goal-usage/index.ts`)

GET handler: Returns level progress per overtuiging for a program.
- Query params: `programId` (required)
- Returns: `{ [overtuigingId]: { currentLevel: number, completedLevels: string[] } }`
- Fetches all usage records, filters by user + program

POST handler: Creates usage record with level validation.
- Body: `{ userId, overtuigingId, programId, level, date }`
- Validates sequential progression:
  - "Niveau 1" always allowed
  - "Niveau 2" requires "Niveau 1" exists for this overtuiging+program
  - "Niveau 3" requires "Niveau 2" exists
- Awards +1 bonus point (calls same pattern as personal-goal-usage)
- Updates streak fields

**File: `api/persoonlijke-overtuigingen/index.ts`** (pattern: `api/personal-goals/index.ts`)

GET: Returns active personal overtuigingen for authenticated user
POST: Creates new personal overtuiging linked to user + optional program

**File: `api/persoonlijke-overtuigingen/[id].ts`** (pattern: `api/personal-goals/[id].ts`)

PATCH: Update name or status
DELETE: Delete personal overtuiging

**File: `api/programs/[id].ts`** — Add 1 line in handlePatch (after line ~256):
```ts
if (body.overtuigingen !== undefined) {
  fields[PROGRAM_FIELDS.overtuigingen] = body.overtuigingen
}
```

**File: `server.ts`** — Add after overtuigingen read routes:
```ts
// Overtuiging usage routes
const { default: overtuigingUsageHandler } = await import("./api/overtuiging-usage/index.js")
app.get("/api/overtuiging-usage", wrapVercelHandler(overtuigingUsageHandler))
app.post("/api/overtuiging-usage", wrapVercelHandler(overtuigingUsageHandler))

// Persoonlijke overtuigingen routes
const { default: persoonlijkeOvertuigingenHandler } = await import("./api/persoonlijke-overtuigingen/index.js")
const { default: persoonlijkeOvertuigingByIdHandler } = await import("./api/persoonlijke-overtuigingen/[id].js")
app.get("/api/persoonlijke-overtuigingen", wrapVercelHandler(persoonlijkeOvertuigingenHandler))
app.post("/api/persoonlijke-overtuigingen", wrapVercelHandler(persoonlijkeOvertuigingenHandler))
app.patch("/api/persoonlijke-overtuigingen/:id", wrapVercelHandler(persoonlijkeOvertuigingByIdHandler))
app.delete("/api/persoonlijke-overtuigingen/:id", wrapVercelHandler(persoonlijkeOvertuigingByIdHandler))
```

**File: `src/lib/api-client.ts`** — Add:
```ts
overtuigingUsage: {
  get: (programId: string, accessToken: string) =>
    request<Record<string, { currentLevel: number; completedLevels: string[] }>>(
      `/overtuiging-usage?programId=${encodeURIComponent(programId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
  create: (data: { userId: string; overtuigingId: string; programId: string; level: string; date: string }, accessToken: string) =>
    request<{ id: string; pointsAwarded: number }>(
      "/overtuiging-usage",
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(data) }
    )
},

persoonlijkeOvertuigingen: {
  list: (accessToken: string) =>
    request<PersoonlijkeOvertuiging[]>("/persoonlijke-overtuigingen",
      { headers: { Authorization: `Bearer ${accessToken}` } }),
  create: (data: CreatePersoonlijkeOvertuigingData, accessToken: string) =>
    request<PersoonlijkeOvertuiging>("/persoonlijke-overtuigingen",
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(data) }),
  update: (id: string, data: UpdatePersoonlijkeOvertuigingData, accessToken: string) =>
    request<PersoonlijkeOvertuiging>(`/persoonlijke-overtuigingen/${encodeURIComponent(id)}`,
      { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(data) }),
  delete: (id: string, accessToken: string) =>
    request<void>(`/persoonlijke-overtuigingen/${encodeURIComponent(id)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } })
},
```

**File: `src/hooks/queries.ts`** — Add mutation hooks following existing patterns (useCreatePersonalGoal, useCompletePersonalGoal).

Also add `overtuigingen?: string[]` to `useUpdateProgram` data type.

---

## Phase 4: Browse Page + Bottom Nav [MEDIUM RISK]

First visible UI change. New page + BottomNav modification.

### Tasks

- [ ] Create `src/pages/OvertuigingenPage.tsx` — browse page with search + filter [complex]
  - [ ] Search input (name + goal text match)
  - [ ] Goal filter chips
  - [ ] Card list with name, category subtitle, level indicators
  - [ ] Sorted by order field
- [ ] Add "Mindset" tab to `src/components/BottomNav.tsx` (5th tab between Methodes and Account)
- [ ] Add routes to `src/App.tsx`: `/overtuigingen` and `/overtuigingen/:id`

### Technical Details

**File: `src/components/BottomNav.tsx`** — Replace tabs array:
```ts
import { Home, Calendar, BookOpen, Lightbulb, User } from "lucide-react"

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/programs", icon: Calendar, label: "Programma" },
  { path: "/methods", icon: BookOpen, label: "Methodes" },
  { path: "/overtuigingen", icon: Lightbulb, label: "Mindset" },
  { path: "/account", icon: User, label: "Account" }
]
```

**File: `src/App.tsx`** — Add inside ProtectedRoute after methods route:
```tsx
import { OvertuigingenPage } from "@/pages/OvertuigingenPage"
import { OvertuigingDetailPage } from "@/pages/OvertuigingDetailPage"

<Route path="/overtuigingen" element={<OvertuigingenPage />} />
<Route path="/overtuigingen/:id" element={<OvertuigingDetailPage />} />
```

**File: `src/pages/OvertuigingenPage.tsx`** — Replicate `MethodsPage.tsx` pattern:
- Uses `useOvertuigingen()` + `useGoals()` + `useMindsetCategories()`
- Search matches on name + linked goal names (via category → goals)
- Filter chips from goals (like MethodsPage)
- OvertuigingCard shows: name, category name subtitle, colored level circles (3 dots)
- No photo (unlike MethodCard)
- Sorted by `order` field

---

## Phase 5: Practice & Check-off Components [MEDIUM RISK]

Reusable section component for Home + Program detail pages.

### Tasks

- [ ] Create `src/components/OvertuigingenSection.tsx` — practice section [complex]
  - [ ] Shows active system overtuigingen for program with 3-level progress circles
  - [ ] Check-off button advances to next level + awards point
  - [ ] Shows personal overtuigingen with simple check-off
  - [ ] "Add" button for new personal overtuiging
- [ ] Create `src/components/PersoonlijkeOvertuigingDialog.tsx` — add/edit dialog

### Technical Details

**File: `src/components/OvertuigingenSection.tsx`** — Pattern: `PersonalGoalsSection.tsx`

Props: `{ programId: string; showManageLink?: boolean }`

Data fetching:
- `useOvertuigingUsage(programId)` — get level progress
- Program's `overtuigingen` field — get linked overtuiging IDs
- `useOvertuigingen()` — get full overtuiging objects
- `usePersoonlijkeOvertuigingen()` — get personal ones

Level progress visualization:
- 3 circles per overtuiging (styled like progress dots)
- Filled = completed, outlined = available next, grayed = locked
- Color: primary for completed, muted for locked

Check-off logic:
- Determines next level: if no levels completed → "Niveau 1", if "Niveau 1" done → "Niveau 2", etc.
- On click: POST to overtuiging-usage + award point via rewards
- After "Niveau 3": show completed state

**File: `src/components/PersoonlijkeOvertuigingDialog.tsx`** — Pattern: `PersonalGoalDialog.tsx`
- Single field: name
- Links to current program via programId prop
- Uses `useCreatePersoonlijkeOvertuiging()` mutation

---

## Phase 6: Program Wizard Integration [HIGHER RISK]

Modifies existing wizard. Step indices shift.

### Tasks

- [ ] Create `src/components/ProgramWizard/OvertuigingenStep.tsx` — wizard step
- [ ] Update `src/components/ProgramWizard/types.ts` — add `overtuigingen` to WizardState, update STEPS
- [ ] Update `src/components/ProgramWizard/index.tsx` — insert step, shift indices, save overtuigingen [complex]
  - [ ] Import + render OvertuigingenStep at step 2
  - [ ] Shift ScheduleStep → 3, MethodsStep → 4, ConfirmationStep → 5
  - [ ] Add `handleOvertuigingenComplete()` handler
  - [ ] Include `overtuigingen` in `handleSave`
- [ ] Update `src/components/ProgramWizard/ConfirmationStep.tsx` — add overtuigingen summary

### Technical Details

**File: `src/components/ProgramWizard/types.ts`**:
```ts
// Add to WizardState:
overtuigingen: string[]

// Update STEPS array:
export const STEPS = [
  { title: "Basis", description: "Startdatum en duur" },
  { title: "Doelen", description: "Wat wil je bereiken?" },
  { title: "Mindset", description: "Kies overtuigingen" },   // NEW
  { title: "Schema", description: "Wanneer train je?" },
  { title: "Methodes", description: "Jouw oefeningen" },
  { title: "Bevestig", description: "Overzicht" }
]
```

**File: `src/components/ProgramWizard/OvertuigingenStep.tsx`**:
- Fetches overtuigingen by selected goals via `useOvertuigingsByGoals(state.goals)`
- Auto-selects up to 3 (sorted by order, first 3)
- User can toggle selection on/off
- "Je kunt later meer toevoegen" note at bottom
- Next/Back navigation buttons

**File: `src/components/ProgramWizard/index.tsx`**:
- Step indices shift: BasicInfo=0, Goals=1, Overtuigingen=2, Schedule=3, Methods=4, Confirmation=5
- New handler `handleOvertuigingenComplete` (simple: just go to next step, overtuigingen saved in state)
- In `handleSave`, add `overtuigingen` to the program update call:
```ts
await api.programs.update(state.programId, {
  methods: state.methods.length > 0 ? state.methods : undefined,
  overtuigingen: state.overtuigingen.length > 0 ? state.overtuigingen : undefined,
  notes: state.notes || undefined
}, accessToken)
```

**File: `src/components/ProgramWizard/ConfirmationStep.tsx`**:
- Add overtuigingen summary section (between Goals and Schedule):
```tsx
{selectedOvertuigingen.length > 0 && (
  <div className="space-y-2 mb-4">
    <div className="flex items-center gap-2">
      <Lightbulb className="h-4 w-4 text-muted-foreground" />
      <p className="text-sm font-medium">Overtuigingen</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {selectedOvertuigingen.map(o => (
        <span key={o.id} className="px-3 py-1 text-sm rounded-full bg-amber-100 text-amber-700">
          {o.name}
        </span>
      ))}
    </div>
  </div>
)}
```

Need to pass overtuigingen data. Options:
- Add `overtuigingenData: Overtuiging[]` to StepProps, or
- Use `useOvertuigingen()` hook directly in ConfirmationStep

---

## Phase 7: Home + Program Detail Integration [HIGHER RISK]

Modifies existing, heavily-used pages.

### Tasks

- [ ] Add `<OvertuigingenSection>` to `src/pages/HomePage.tsx` (between program progress and personal goals)
- [ ] Add `<OvertuigingenSection>` to `src/pages/ProgramDetailPage.tsx`
- [ ] Resolve overtuigingen link to full objects in `api/programs/[id].ts` GET handler

### Technical Details

**File: `src/pages/HomePage.tsx`** — Add after the program progress Card (line ~406), before PersonalGoalsSection:
```tsx
import { OvertuigingenSection } from "@/components/OvertuigingenSection"

{runningProgram && (
  <section className="grid gap-4">
    <OvertuigingenSection programId={runningProgram.id} />
  </section>
)}
```

**File: `src/pages/ProgramDetailPage.tsx`** — Add after Goals section (line ~283), before Methods:
```tsx
import { OvertuigingenSection } from "@/components/OvertuigingenSection"

<OvertuigingenSection programId={program.id} showManageLink={status === "running"} />
```

**File: `api/programs/[id].ts`** — In GET handler, after goalDetails fetch (line ~79), add overtuigingen resolution:
```ts
// Fetch related overtuigingen
let overtuigingDetails: any[] = []
const validOvertuigingen = (program.overtuigingen || []).filter(oid => isValidRecordId(oid))
if (validOvertuigingen.length > 0) {
  const overtuigingFormula = `OR(${validOvertuigingen.map(oid => `RECORD_ID() = "${oid}"`).join(",")})`
  const overtuigingRecords = await base(tables.overtuigingen)
    .select({ filterByFormula: overtuigingFormula, returnFieldsByFieldId: true })
    .all()
  overtuigingDetails = overtuigingRecords.map(r => transformOvertuiging(r as any))
}
```

Add `overtuigingDetails` to the response object (line ~184).

Update `ProgramDetail` interface in `src/types/program.ts`:
```ts
export interface ProgramDetail extends Program {
  // ... existing fields
  overtuigingDetails: Overtuiging[]
}
```

---

## Phase 8: Points & Rewards [MEDIUM RISK]

### Tasks

- [ ] Add activity type `"overtuiging"` to `api/rewards/award.ts` schema
- [ ] Add `"overtuiging"` to `AwardRequest` type in `src/types/rewards.ts`
- [ ] Add `overtuiging: 1` to `POINTS` constant in `src/types/rewards.ts`

### Technical Details

**File: `api/rewards/award.ts`** — Update awardSchema (line ~77):
```ts
activityType: z.enum(["method", "habit", "program", "sessionBonus", "habitDayBonus", "programMilestone", "overtuiging"])
```

Note: The actual point awarding for overtuigingen happens in `api/overtuiging-usage/index.ts` POST handler (same pattern as `personal-goal-usage/index.ts` — updates streak + bonusPoints directly). The `rewards/award.ts` change is for consistency if the frontend calls it directly.

**File: `src/types/rewards.ts`** — Update:
```ts
export interface AwardRequest {
  activityType: "method" | "habit" | "program" | "sessionBonus" | "habitDayBonus" | "programMilestone" | "overtuiging"
  // ... rest unchanged
}

export const POINTS = {
  // ... existing
  overtuiging: 1  // Bonus point per level completion
} as const
```

---

## Phase Dependencies

```
Phase 1 (mappings/types)      ← foundation, must be first
Phase 2 (read APIs)           ← depends on Phase 1
Phase 3 (write APIs)          ← depends on Phase 1
Phase 4 (browse page)         ← depends on Phase 2
Phase 5 (practice components) ← depends on Phase 3
Phase 6 (wizard)              ← depends on Phase 2, 3
Phase 7 (home/detail)         ← depends on Phase 5
Phase 8 (rewards)             ← depends on Phase 3
```

Phases 2+3 can run in parallel. Phases 4+5+6+8 can run in parallel (after 2+3).

## Phase 9: AI Program Generation Integration [MEDIUM RISK]

Auto-select overtuigingen in the AI program creation flow (AIProgramWizard).

### Tasks

- [x] Add overtuigingen auto-selection to `api/programs/preview.ts` — fetch by goals via mindset categories, select top 3 by order
- [x] Add overtuigingen auto-selection to `api/programs/generate.ts` — same logic, save to program
- [x] Accept `overtuigingen` in `api/programs/confirm.ts` body, save to program record
- [x] Add `suggestedOvertuigingen` to `AIPreviewResponse` in `src/types/program.ts`
- [x] Add `overtuigingen` to `AIConfirmRequest` in `src/types/program.ts`
- [x] Add `suggestedOvertuigingen` to `AIPreviewResult` in `src/components/AIProgramWizard/types.ts`
- [x] Pass overtuigingen from preview to confirm in `src/components/AIProgramWizard/index.tsx`
- [x] Show overtuigingen in `ScheduleReview.tsx` (review phase)
- [x] Show overtuigingen in `ProgramResult.tsx` (result phase)

### Technical Details

**Selection logic (server-side, deterministic):**
1. Fetch all mindset categories
2. Filter categories whose `goalIds` intersect with selected program goals
3. Collect all unique overtuiging IDs from matching categories
4. Fetch those overtuigingen records
5. Sort by `order` field ascending
6. Take first 3 (configurable)

This is the same logic as `OvertuigingenStep` in the manual wizard but executed server-side. No GPT-4o involvement needed — overtuigingen selection is deterministic based on goals.

**File: `api/programs/preview.ts`** — After AI call, before returning response:
```ts
// Auto-select up to 3 overtuigingen based on goals (via mindset categories)
const categoryRecords = await base(tables.mindsetCategories)
  .select({ returnFieldsByFieldId: true }).all()
const categories = categoryRecords.map(r => transformMindsetCategory(r as any))
const matchingCategories = categories.filter(cat =>
  cat.goalIds.some(gid => body.goals.includes(gid))
)
const overtuigingIds = [...new Set(
  matchingCategories.flatMap(cat => cat.overtuigingIds)
)]
// Fetch and select top 3 by order
let suggestedOvertuigingen = []
if (overtuigingIds.length > 0) {
  const formula = `OR(${overtuigingIds.map(id => `RECORD_ID() = "${id}"`).join(",")})`
  const records = await base(tables.overtuigingen)
    .select({ filterByFormula: formula, returnFieldsByFieldId: true }).all()
  suggestedOvertuigingen = records
    .map(r => transformOvertuiging(r as any))
    .sort((a, b) => a.order - b.order)
    .slice(0, 3)
}
// Include in response
return sendSuccess(res, { ...existingFields, suggestedOvertuigingen })
```

**File: `api/programs/confirm.ts`** — Accept and save:
```ts
if (body.overtuigingen?.length > 0) {
  programFields[PROGRAM_FIELDS.overtuigingen] = body.overtuigingen
}
```

**File: `src/types/program.ts`**:
```ts
// Add to AIPreviewResponse:
suggestedOvertuigingen?: Overtuiging[]

// Add to AIConfirmRequest:
overtuigingen?: string[]
```

**File: `src/components/AIProgramWizard/index.tsx`**:
```ts
// In handleConfirm, extract overtuiging IDs from preview
const overtuigingen = preview.suggestedOvertuigingen?.map(o => o.id) || []
// Pass to confirm call
const response = await api.programs.confirm({ ...existingData, overtuigingen }, accessToken)
```

**File: `src/components/AIProgramWizard/ScheduleReview.tsx`**:
- Show overtuigingen as amber chips in the summary section
- "Je kunt deze later aanpassen in je programma." note

**File: `src/components/AIProgramWizard/ProgramResult.tsx`**:
- Resolve overtuiging names via `useOvertuigingen()` hook
- Show as amber chips in the Program Overzicht area

---

## Phase 10: Add System Overtuigingen from Program Detail [MEDIUM RISK]

Allow users to add system overtuigingen (filtered by program goals) from the OvertuigingenSection.

### Tasks

- [x] Create `src/components/AddOvertuigingDialog.tsx` — replaces PersoonlijkeOvertuigingDialog in OvertuigingenSection
  - [x] Shows selectable list of system overtuigingen (filtered by goals, excluding already-added)
  - [x] Toggle to select multiple
  - [x] Saves via `useUpdateProgram` (adds to program's overtuigingen array)
  - [x] "of" divider + expandable personal overtuiging form
- [x] Update `src/components/OvertuigingenSection.tsx` — use AddOvertuigingDialog, fetch goal-related overtuigingen

### Technical Details

**File: `src/components/AddOvertuigingDialog.tsx`**:
- Props: `{ open, onOpenChange, programId, currentOvertuigingen: string[], availableOvertuigingen: Overtuiging[] }`
- Two sections:
  1. System overtuigingen list (toggle buttons with check/lightbulb icons)
  2. Personal overtuiging form (name input, expandable via "Eigen overtuiging toevoegen" button)
- On save: Updates program.overtuigingen via `useUpdateProgram` + optionally creates personal overtuiging
- Button label shows count: "3 toevoegen"

**File: `src/components/OvertuigingenSection.tsx`**:
- Fetches `useOvertuigingsByGoals(program.goals)` for available system overtuigingen
- Computes `availableToAdd = goalOvertuigingen.filter(not already in program)`
- Passes to `AddOvertuigingDialog`

---

## Phase Dependencies (Updated)

```
Phase 1 (mappings/types)      ← foundation, must be first
Phase 2 (read APIs)           ← depends on Phase 1
Phase 3 (write APIs)          ← depends on Phase 1
Phase 4 (browse page)         ← depends on Phase 2
Phase 5 (practice components) ← depends on Phase 3
Phase 6 (wizard)              ← depends on Phase 2, 3
Phase 7 (home/detail)         ← depends on Phase 5
Phase 8 (rewards)             ← depends on Phase 3
Phase 9 (AI generation)       ← depends on Phase 1, 2
Phase 10 (add from detail)    ← depends on Phase 5, 7
```

## Verification

After each phase:
- `npm run build` — zero TypeScript errors
- `npm test` — all existing tests pass

Final verification:
- Manual: Browse overtuigingen page → search + filter works
- Manual: Create program with goals → overtuigingen suggested → max 3 selected
- Manual: Home page shows active overtuigingen → check off level 1 → level 2 appears
- Manual: Create personal overtuiging → check off → +1 point awarded
- Manual: Program detail shows overtuigingen section with progress
- Manual: AI program wizard → preview shows suggested overtuigingen → confirm saves them
- Manual: Program detail → "Toevoegen" → shows system overtuigingen from goals to add
