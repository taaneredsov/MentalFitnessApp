# Requirements: Delete Program

## Overview

Allow users to delete a program they no longer need. This is a destructive, irreversible operation that removes the program and all related data (method usages, schedule sessions). The feature is accessed from the program edit dialog and includes a confirmation step to prevent accidental deletion.

## Problem Statement

Users accumulate programs over time that are no longer relevant - test programs, abandoned programs, or programs that were created by mistake. Without the ability to delete, the program list becomes cluttered and harder to navigate. Currently users have no way to remove unwanted programs.

## User Stories

### US-1: Delete Program
**As a** user with a program I no longer need
**I want to** delete the program and all its related data
**So that** I can keep my program list clean and focused

### US-2: Confirmation Before Deletion
**As a** user about to delete a program
**I want to** be warned that deletion is permanent and see what will be removed
**So that** I don't accidentally lose my data

## Functional Requirements

### FR-1: Delete Flow (UI)
1. User opens program detail page
2. User clicks "Bewerk programma" to open the edit dialog
3. At the bottom of the edit dialog, a "Verwijder programma" button is visible (red ghost button with Trash2 icon)
4. Clicking the button shows a confirmation view within the dialog with a warning about permanent deletion
5. Confirming triggers the delete operation
6. On success: shows a success toast and redirects to `/programs`
7. On failure: shows an error toast, dialog remains open

### FR-2: Backend - Postgres Path
- New `deleteProgramById()` function in program repo
- Transaction-based deletion to ensure atomicity:
  1. Verify the requesting user owns the program
  2. Collect all `method_usage` IDs linked to the program's schedules
  3. Collect all `schedule` IDs linked to the program
  4. Delete `method_usages` rows
  5. Delete the program (schedules cascade via foreign key)
  6. Return the deleted IDs for Airtable sync
- Enqueue Airtable delete events (via outbox) for:
  - Each deleted method_usage record
  - Each deleted schedule record
  - The program record itself

### FR-3: API Endpoint
- `DELETE /api/programs/[id]` handler in existing `api/programs/[id].ts`
- Requires authentication (`requireAuth()`)
- Returns deleted entity IDs for client-side cache invalidation

### FR-4: Frontend Implementation
- `programs.delete(id)` method in API client
- `useDeleteProgram()` React Query mutation hook with cache invalidation
- Delete button in `ProgramEditDialog` footer (red ghost button, Trash2 icon)
- Confirmation view in `ProgramEditDialog` with destructive styling
- `ProgramDetailPage` wires up the delete handler with navigation to `/programs`

## Non-Functional Requirements

### NFR-1: Performance
- Delete operation should complete in < 3 seconds (transaction with multiple table deletes)

### NFR-2: Security
- Verify user owns the program before allowing deletion
- Validate program ID format with `isValidRecordId()` or equivalent

### NFR-3: Data Integrity
- Use a database transaction to ensure all-or-nothing deletion
- Airtable sync events enqueued within the same transaction (outbox pattern)

## Acceptance Criteria

### AC-1: Delete Button Visibility
- [ ] Delete button visible in program edit dialog
- [ ] Button uses destructive styling (red ghost button with Trash2 icon)

### AC-2: Confirmation Dialog
- [ ] Confirmation view shows before deletion proceeds
- [ ] Warning text clearly states deletion is permanent
- [ ] User can cancel and return to the edit dialog

### AC-3: Deletion Execution
- [ ] Program and all related data deleted in Postgres (method_usages, schedules, program)
- [ ] Airtable sync events enqueued for all deleted entities
- [ ] Transaction ensures atomicity (all or nothing)

### AC-4: Post-Deletion UX
- [ ] Success toast shown after deletion
- [ ] User redirected to `/programs` after deletion
- [ ] Program list no longer shows the deleted program

### AC-5: Error Handling
- [ ] Network errors show user-friendly error toast
- [ ] Failed deletion does not leave partially deleted data

### AC-6: Build
- [ ] TypeScript compiles without errors

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `api/_lib/repos/program-repo.ts` | Modify | Add `deleteProgramById()` with transactional deletion |
| `api/programs/[id].ts` | Modify | Add DELETE handler |
| `src/lib/api-client.ts` | Modify | Add `programs.delete()` method |
| `src/hooks/queries.ts` | Modify | Add `useDeleteProgram()` mutation hook |
| `src/components/ProgramEditDialog.tsx` | Modify | Add delete button + confirmation view |
| `src/pages/ProgramDetailPage.tsx` | Modify | Wire up delete handler with navigation |

## Dependencies

- Existing `ProgramEditDialog` component
- Existing `api/programs/[id].ts` endpoint (add DELETE method)
- Existing outbox/sync pattern for Airtable event enqueueing
- Existing toast system for success/error feedback

## Out of Scope (Future Enhancements)

- Bulk deletion of multiple programs
- Soft-delete with undo/restore capability
- Archiving as an alternative to deletion
- Admin-level deletion of other users' programs
