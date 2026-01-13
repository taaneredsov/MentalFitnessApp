# Implementation Plan: Method Usage Tracking

## Overview

Implement media progress tracking in the MethodDetailPage, create an API endpoint to record completed sessions, add a feedback modal after media completion, and link usage to program when navigating from a program.

## Phase 1: API & Field Mappings

Add the Method Usage table field mappings and create the API endpoint.

### Tasks

- [x] Get Method Usage table field IDs from Airtable (user, method, program, usedAt, remark)
- [x] Add METHOD_USAGE_FIELDS to field-mappings.js
- [x] Add transformMethodUsage function to field-mappings.js
- [x] Create `api/method-usage/index.ts` POST endpoint to create usage records

### Technical Details

**Method Usage table (tblktNOXF3yPPavXU) field IDs:**
- name: `fldt25MnO1OilxFOF` (Name - auto-generated)
- user: `fldlJtJOwZ4poOcoN` (Gebruiker - link to Users)
- method: `fldPyWglLXgXVO0ru` (Methode - link to Methods)
- program: `fld18WcaPR8nXNr4a` (Mentale Fitnessprogramma's - link to Programs)
- usedAt: `fldvUGcgnwuux1bvi` (Gebruikt op - date)
- remark: `fldpskQnKFWDFGRFk` (Opmerking - multiline text)
- goals: `fldYrzWJeMcyf4kNi` (Doelstellingen - link to Goals)

**API endpoint POST /api/method-usage:**
```typescript
// Request body
{
  userId: string      // Airtable user record ID
  methodId: string    // Airtable method record ID
  programId?: string  // Optional: Airtable program record ID
  remark?: string     // Optional feedback text
}

// Response
{
  id: string          // Created record ID
  success: true
}
```

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

## Phase 4: Integration

Wire up all components and add API client method.

### Tasks

- [x] Add `methodUsage.create()` to api-client.ts
- [x] Update MethodDetailPage to track completion across all media
- [x] Show feedback modal on first media completion
- [x] Call API with user ID, method ID, and optional remark
- [x] Visual feedback for completed media (green ring + checkmark)

### Technical Details

**Files modified:**
- `src/lib/api-client.ts` - Added methodUsage.create() method
- `src/pages/MethodDetailPage.tsx` - Integrated progress tracking and feedback modal

**MediaPlayer enhancements:**
- Shows green ring and checkmark icon when media is completed
- Displays "Afgerond" label on completed media

## Phase 5: Program Linking

Link method usage to program when navigating from a program context.

### Tasks

- [x] Add program field ID to METHOD_USAGE_FIELDS (`fld18WcaPR8nXNr4a`)
- [x] Update API endpoint to accept optional programId
- [x] Update api-client.ts to accept programId parameter
- [x] Update HomePage to pass programId via navigation state
- [x] Update ProgramDetailPage to pass programId via navigation state
- [x] Update MethodDetailPage to receive programId from location.state
- [x] Include programId when creating usage record

### Technical Details

**Navigation state interface:**
```typescript
interface LocationState {
  programId?: string
}
```

**Usage in pages:**
```typescript
// HomePage & ProgramDetailPage - navigating to method
navigate(`/methods/${method.id}`, {
  state: { programId: program.id }
})

// MethodDetailPage - receiving programId
const location = useLocation()
const programId = (location.state as LocationState)?.programId

// API call includes programId
await api.methodUsage.create({
  userId: user.id,
  methodId: method.id,
  programId: programId || undefined,
  remark
}, accessToken)
```

## Verification

1. Play audio/video to 80% - verify completion triggers
2. Check Airtable Method Usage table for new record
3. Verify record has correct user, method, and timestamp
4. Submit feedback - verify Opmerking field is populated
5. Skip feedback - verify record is still created without remark
6. Navigate to method from program - verify program link is set in usage record
7. Navigate to method from Methods tab - verify no program link (null)
