# Implementation Plan: Method Usage Tracking

## Overview

Implement media progress tracking in the MethodDetailPage, create an API endpoint to record completed sessions, add a feedback modal after media completion, and **link usage to Programmaplanning** when navigating from a program schedule.

## Pre-requisites: Airtable Schema Update

Before implementation, the Airtable schema needs to be updated:

### Required Airtable Changes

1. **Method Usage table (tblktNOXF3yPPavXU)**:
   - Add new field "Programmaplanning" (link to Programmaplanning table)
   - **OR** rename existing "Mentale Fitnessprogramma's" field to link to Programmaplanning instead
   - Get the new field ID for `METHOD_USAGE_FIELDS.programmaplanning`

2. **Verify bidirectional link**:
   - Programmaplanning table already has `methodUsage` field (`fldoxGlLYZ5NI60hl`)
   - Ensure it's configured as the bidirectional link to Method Usage

---

## Phase 1: API & Field Mappings

Add the Method Usage table field mappings and create the API endpoint.

### Tasks

- [x] Get Method Usage table field IDs from Airtable (user, method, programmaplanning, usedAt, remark)
- [x] Add METHOD_USAGE_FIELDS with program field
- [x] Add transformMethodUsage function to field-mappings.js
- [x] Create `api/method-usage/index.ts` POST endpoint with programId
- [ ] **Future**: Update METHOD_USAGE_FIELDS to use `programmaplanning` instead of `program`

### Technical Details

**Method Usage table (tblktNOXF3yPPavXU) field IDs:**
- name: `fldt25MnO1OilxFOF` (Name - auto-generated)
- user: `fldlJtJOwZ4poOcoN` (Gebruiker - link to Users)
- method: `fldPyWglLXgXVO0ru` (Methode - link to Methods)
- programmaplanning: `fld???` (**NEW** - Programmaplanning - link to Programmaplanning)
- usedAt: `fldvUGcgnwuux1bvi` (Gebruikt op - date)
- remark: `fldpskQnKFWDFGRFk` (Opmerking - multiline text)
- goals: `fldYrzWJeMcyf4kNi` (Doelstellingen - link to Goals)

> **Action Required**: Get the Programmaplanning field ID from Airtable after creating the link field.

**API endpoint POST /api/method-usage:**
```typescript
// Request body
{
  userId: string              // Airtable user record ID
  methodId: string            // Airtable method record ID
  programmaplanningId?: string // Optional: Airtable Programmaplanning record ID
  remark?: string             // Optional feedback text
}

// Response
{
  id: string          // Created record ID
  success: true
}
```

**Field Mappings Update (api/_lib/field-mappings.js):**
```javascript
export const METHOD_USAGE_FIELDS = {
  name: "fldt25MnO1OilxFOF",
  user: "fldlJtJOwZ4poOcoN",
  method: "fldPyWglLXgXVO0ru",
  programmaplanning: "fld???",  // NEW: replaces 'program' field
  usedAt: "fldvUGcgnwuux1bvi",
  remark: "fldpskQnKFWDFGRFk",
  goals: "fldYrzWJeMcyf4kNi"
}
```

---

## Phase 2: Media Progress Tracking

Add progress tracking to the MediaPlayer component.

### Tasks

- [x] Create useMediaProgress hook to track playback position
- [x] Add timeupdate event listener to audio/video elements
- [x] Calculate completion percentage (currentTime / duration * 100)
- [x] Trigger onComplete callback when reaching 80% threshold
- [x] Prevent duplicate completions (track per media ID)

### Technical Details

**useMediaProgress hook created at:** `src/hooks/useMediaProgress.ts`

Features:
- Tracks playback progress as percentage
- Triggers onComplete callback at 80% threshold (configurable)
- Also triggers on media ended event
- Prevents duplicate triggers with useRef
- Resets state when mediaId changes

---

## Phase 3: Feedback Modal

Create a modal component that appears after media completion.

### Tasks

- [x] Create FeedbackModal component with textarea input
- [x] Add submit and skip buttons
- [x] Integrate modal into MethodDetailPage
- [x] Show modal when any media reaches completion
- [x] Call API to create usage record on submit/skip

### Technical Details

**Created components:**
- `src/components/ui/dialog.tsx` - Radix Dialog wrapper
- `src/components/ui/textarea.tsx` - Textarea component
- `src/components/FeedbackModal.tsx` - Feedback modal with submit/skip

**Installed dependencies:**
- `@radix-ui/react-dialog`

---

## Phase 4: Integration

Wire up all components and add API client method.

### Tasks

- [x] Add `methodUsage.create()` to api-client.ts
- [x] Implement api-client.ts with programId
- [x] Update MethodDetailPage to track completion across all media
- [x] Show feedback modal on first media completion
- [x] API call uses programId from navigation state
- [x] Visual feedback for completed media (green ring + checkmark)
- [ ] **Future**: Update API call to use `programmaplanningId`

### Technical Details

**Files modified:**
- `src/lib/api-client.ts` - Update methodUsage.create() method signature
- `src/pages/MethodDetailPage.tsx` - Integrated progress tracking and feedback modal

**MediaPlayer enhancements:**
- Shows green ring and checkmark icon when media is completed
- Displays "Afgerond" label on completed media

**Updated api-client.ts:**
```typescript
methodUsage: {
  create: (data: {
    userId: string
    methodId: string
    programmaplanningId?: string  // Changed from programId
    remark?: string
  }, token: string) =>
    request<{ id: string }>('/method-usage', {
      method: 'POST',
      body: data,
      token
    })
}
```

---

## Phase 5: Programmaplanning Linking

Link method usage to Programmaplanning when navigating from a program's schedule.

### Tasks

- [ ] Add programmaplanning field ID to METHOD_USAGE_FIELDS
- [ ] Update API endpoint to accept optional `programmaplanningId`
- [ ] Update api-client.ts to accept `programmaplanningId` parameter
- [ ] Update HomePage to pass `programmaplanningId` via navigation state
- [ ] Update ProgramDetailPage to pass `programmaplanningId` via navigation state
- [ ] Update MethodDetailPage to receive `programmaplanningId` from location.state
- [ ] Include `programmaplanningId` when creating usage record

### Technical Details

**Navigation state interface:**
```typescript
interface LocationState {
  programmaplanningId?: string  // Changed from programId
}
```

**Usage in pages:**
```typescript
// HomePage & ProgramDetailPage - navigating to method from schedule
// Pass the specific Programmaplanning record ID
navigate(`/methods/${method.id}`, {
  state: { programmaplanningId: scheduleItem.id }
})

// MethodDetailPage - receiving programmaplanningId
const location = useLocation()
const programmaplanningId = (location.state as LocationState)?.programmaplanningId

// API call includes programmaplanningId
await api.methodUsage.create({
  userId: user.id,
  methodId: method.id,
  programmaplanningId: programmaplanningId || undefined,
  remark
}, accessToken)
```

**Schedule display update:**
When showing the program schedule (Programmaplanning records), each item should:
1. Show the date and planned methods
2. Show completion status (based on methodUsage link)
3. Navigate to method with `programmaplanningId` in state

---

## Phase 6: Completion Status Display

Show which Programmaplanning sessions are completed in the UI.

### Tasks

- [ ] Fetch Programmaplanning records with methodUsage populated
- [ ] Add visual indicator for completed sessions (checkmark)
- [ ] Show completion status on HomePage upcoming activity
- [ ] Show completion status on ProgramDetailPage schedule

### Technical Details

**Determining completion status:**
```typescript
// A Programmaplanning is "completed" when it has at least one methodUsage linked
const isCompleted = (programmaplanning.methodUsage || []).length > 0

// Or more strictly: all planned methods have been used
const isFullyCompleted = programmaplanning.methodIds.every(methodId =>
  programmaplanning.methodUsageDetails?.some(usage => usage.methodId === methodId)
)
```

**UI updates:**
- Schedule list items show checkmark for completed sessions
- Progress bar uses completed Programmaplanning count (see activity-based-progress spec)

---

## Verification

1. Play audio/video to 80% - verify completion triggers
2. Check Airtable Method Usage table for new record
3. Verify record has correct user, method, and timestamp
4. Submit feedback - verify Opmerking field is populated
5. Skip feedback - verify record is still created without remark
6. Navigate to method from program schedule - verify **Programmaplanning** link is set
7. Navigate to method from Methods tab - verify no Programmaplanning link (null)
8. Check Programmaplanning.methodUsage field shows the linked record
9. Verify program schedule shows completion status correctly

---

## Migration from Program-level to Programmaplanning-level

### Backward Compatibility

During migration:
1. Keep `programId` parameter temporarily (deprecated)
2. Add `programmaplanningId` as new parameter
3. In API, prefer `programmaplanningId` if provided, fall back to `programId`
4. Update all navigation calls to use `programmaplanningId`
5. Remove `programId` after full migration

### Data Migration (Optional)

Existing Method Usage records linked to Programs could be:
1. Left as-is (legacy data)
2. Migrated to link to appropriate Programmaplanning records (manual or script)

---

## Summary of Changes from Original Implementation

| Component | Original | Updated |
|-----------|----------|---------|
| METHOD_USAGE_FIELDS | `program` field | `programmaplanning` field |
| API request body | `programId` | `programmaplanningId` |
| Navigation state | `{ programId }` | `{ programmaplanningId }` |
| Progress calculation | Count usages linked to program | Count Programmaplanning with usages |
| Completion display | Per program | Per scheduled session |
