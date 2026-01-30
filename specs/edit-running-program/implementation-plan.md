# Implementation Plan: Edit Running Program

## Overview

Enable users to modify their running programs by editing individual session methods and program-level goals/notes. This involves creating new API endpoints for Programmaplanning updates, new UI components for editing, and integrating with existing query hooks.

## Phase 1: API Endpoints ✅ COMPLETE

Create backend endpoints for updating Programmaplanning records.

### Tasks

- [x] Create `PATCH /api/programs/[id]/schedule/[planningId]` endpoint for updating a single session
- [x] Add ownership and date validation (prevent editing past sessions)
- [x] Add session description auto-generation when methods change
- [x] Update `api/_lib/field-mappings.js` if any new field mappings needed (none needed)

### Technical Details

**New File: `api/programs/[id]/schedule/[planningId].ts`**

```typescript
// PATCH /api/programs/[id]/schedule/[planningId]
// Request body: { methods: string[], goals?: string[], notes?: string }
// Response: Updated Programmaplanning object

import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../../../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../../../_lib/api-utils.js"
import { verifyToken } from "../../../_lib/jwt.js"
import { PROGRAM_FIELDS, PROGRAMMAPLANNING_FIELDS, transformProgrammaplanning } from "../../../_lib/field-mappings.js"

// Key validation logic:
// 1. Verify JWT token
// 2. Fetch program, verify user owns it
// 3. Fetch planning record, verify it belongs to program
// 4. Check date > today (cannot edit past)
// 5. Validate methods array not empty
// 6. Update Airtable record
```

**Validation Rules:**
- `methods` array must have at least 1 item
- `planningId` must belong to the program
- Session date must be in the future (date > today's date in local time)
- User must own the program

**Session Description Generation:**
```typescript
// Auto-generate from method names (requires fetching method details)
const sessionDescription = methods
  .map(m => `${m.name} (${m.duration} min)`)
  .join("\n")
```

**Airtable Update Fields:**
```javascript
{
  [PROGRAMMAPLANNING_FIELDS.methods]: methodIds,  // Array of record IDs
  [PROGRAMMAPLANNING_FIELDS.goals]: goalIds,      // Optional
  [PROGRAMMAPLANNING_FIELDS.sessionDescription]: sessionDescription,
  [PROGRAMMAPLANNING_FIELDS.notes]: notes         // Optional
}
```

## Phase 2: Frontend Types & API Client ✅ COMPLETE

Add TypeScript types and API client methods for the new endpoint.

### Tasks

- [x] Add `UpdateProgrammaplanningData` type to `src/types/program.ts`
- [x] Add `updateProgrammaplanning` method to `src/lib/api-client.ts`
- [x] Add query key for programmaplanning in `src/lib/query-keys.ts`
- [x] Create `useUpdateProgrammaplanning` mutation hook in `src/hooks/queries.ts`

### Technical Details

**Type Definition (`src/types/program.ts`):**
```typescript
export interface UpdateProgrammaplanningData {
  methods: string[]  // Method record IDs (required, min 1)
  goals?: string[]   // Goal record IDs (optional)
  notes?: string     // Session notes (optional)
}
```

**API Client Method (`src/lib/api-client.ts`):**
```typescript
async updateProgrammaplanning(
  programId: string,
  planningId: string,
  data: UpdateProgrammaplanningData
): Promise<Programmaplanning> {
  return this.fetch(`/api/programs/${programId}/schedule/${planningId}`, {
    method: "PATCH",
    body: JSON.stringify(data)
  })
}
```

**Query Key (`src/lib/query-keys.ts`):**
```typescript
programmaplanning: (programId: string, planningId: string) =>
  ["programmaplanning", programId, planningId] as const
```

**Mutation Hook (`src/hooks/queries.ts`):**
```typescript
export function useUpdateProgrammaplanning(programId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ planningId, data }: {
      planningId: string
      data: UpdateProgrammaplanningData
    }) => api.updateProgrammaplanning(programId, planningId, data),
    onSuccess: () => {
      // Invalidate program detail to refresh schedule
      queryClient.invalidateQueries({ queryKey: queryKeys.program(programId) })
    }
  })
}
```

## Phase 3: Session Edit Dialog Component ✅ COMPLETE

Create the dialog component for editing a single session's methods.

### Tasks

- [x] Create `src/components/SessionEditDialog.tsx` with method picker UI
- [x] Fetch available methods for the program's goals
- [x] Show current methods with remove option
- [x] Add method picker to add new methods
- [x] Handle save with loading state
- [x] Validate minimum 1 method before save

### Technical Details

**Component File: `src/components/SessionEditDialog.tsx`**

```typescript
interface SessionEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  programId: string
  session: Programmaplanning
  availableMethods: Method[]  // All methods linked to program goals
  onSave: (planningId: string, methodIds: string[]) => Promise<void>
}
```

**UI Structure:**
```
Dialog
├── DialogHeader
│   └── "Bewerk sessie van {formatted date}"
├── DialogContent
│   ├── Current Methods Section
│   │   └── Method pills with X button to remove
│   ├── Add Methods Section
│   │   └── Method picker dropdown/list (filtered to exclude current)
│   └── Session Notes (optional textarea)
├── DialogFooter
    ├── Cancel button
    └── Save button (disabled if < 1 method)
```

**shadcn/ui Components to Use:**
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`
- `Button`
- `Badge` (for method pills)
- `ScrollArea` (for method list)
- `Textarea` (for notes)

**Key Patterns:**
```typescript
// Local state for editing
const [selectedMethodIds, setSelectedMethodIds] = useState<string[]>(
  session.methodIds
)

// Remove method
const handleRemove = (methodId: string) => {
  setSelectedMethodIds(prev => prev.filter(id => id !== methodId))
}

// Add method
const handleAdd = (methodId: string) => {
  setSelectedMethodIds(prev => [...prev, methodId])
}

// Save validation
const canSave = selectedMethodIds.length >= 1
```

## Phase 4: Integrate Edit UI into ProgramDetailPage ✅ COMPLETE (ScrollArea fix applied)

Add edit buttons and integrate the dialog into the existing program detail page.

### Tasks

- [x] Add edit icon button to each future session in `FullScheduleSection`
- [x] Add state management for which session is being edited
- [x] Integrate `SessionEditDialog` into `ProgramDetailPage.tsx`
- [x] Pass available methods from program detail to dialog
- [x] Handle mutation success/error (query invalidation on success)
- [x] Disable edit for past sessions (visual indicator)

### Technical Details

**Files to Modify:**
- `src/pages/ProgramDetailPage.tsx` - Add dialog state and integration
- `src/components/FullScheduleSection.tsx` - Add edit icons

**Session Editability Check:**
```typescript
// Helper to check if session is editable
function isSessionEditable(sessionDate: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const session = new Date(sessionDate)
  session.setHours(0, 0, 0, 0)
  return session > today  // Only future sessions editable
}
```

**Edit Icon in FullScheduleSection:**
```tsx
// Add to each session row (only for future sessions)
{isSessionEditable(session.date) && (
  <Button
    variant="ghost"
    size="icon"
    onClick={(e) => {
      e.stopPropagation()
      onEditSession(session)
    }}
  >
    <Pencil className="h-4 w-4" />
  </Button>
)}
```

**Dialog State in ProgramDetailPage:**
```typescript
const [editingSession, setEditingSession] = useState<Programmaplanning | null>(null)

const updateMutation = useUpdateProgrammaplanning(programId)

const handleSaveSession = async (planningId: string, methodIds: string[]) => {
  await updateMutation.mutateAsync({
    planningId,
    data: { methods: methodIds }
  })
  setEditingSession(null)
  toast.success("Sessie bijgewerkt")
}
```

**Props to Pass:**
```tsx
<SessionEditDialog
  open={!!editingSession}
  onOpenChange={(open) => !open && setEditingSession(null)}
  programId={program.id}
  session={editingSession!}
  availableMethods={program.methodDetails}
  onSave={handleSaveSession}
/>
```

## Phase 5: Program-Level Edit (Goals & Notes) ✅ COMPLETE

Add ability to edit program goals and notes.

### Tasks

- [x] Create `src/components/ProgramEditDialog.tsx` for editing goals and notes
- [x] Add edit button to program header section in `ProgramDetailPage.tsx`
- [x] Use existing `useUpdateProgram` mutation
- [x] Show for both "Actief" and "Gepland" programs (running and planned status)

### Technical Details

**Component File: `src/components/ProgramEditDialog.tsx`**

```typescript
interface ProgramEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  program: ProgramDetail
  allGoals: Goal[]  // All available goals for selection
  onSave: (data: { goals: string[], notes?: string }) => Promise<void>
}
```

**UI Structure:**
```
Dialog
├── DialogHeader
│   └── "Bewerk programma"
├── DialogContent
│   ├── Goals Section
│   │   └── Multi-select checkboxes for goals
│   └── Notes Section
│       └── Textarea for program notes
├── DialogFooter
    ├── Cancel button
    └── Save button
```

**Existing Hook Usage:**
```typescript
// Already exists in codebase
const updateProgram = useUpdateProgram()

const handleSave = async (data: { goals: string[], notes?: string }) => {
  await updateProgram.mutateAsync({
    programId: program.id,
    goals: data.goals,
    notes: data.notes
  })
}
```

**Edit Button Placement:**
```tsx
// In ProgramDetailPage, near program header
{program.status === "Actief" && (
  <Button variant="outline" size="sm" onClick={() => setShowProgramEdit(true)}>
    <Pencil className="h-4 w-4 mr-2" />
    Bewerk
  </Button>
)}
```

## Verification Checklist

After implementation, verify:

- [x] Future sessions show edit icon, past sessions don't
- [x] Edit dialog opens with current methods pre-selected
- [x] Can remove methods (but not below 1)
- [x] Can add methods from available pool
- [x] Save updates Airtable and refreshes UI
- [x] Program edit dialog shows current goals and notes
- [x] Both "Actief" and "Gepland" programs show edit options
- [x] Error states handled gracefully
- [x] Loading states shown during save
