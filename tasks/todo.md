# Current Sprint Tasks

**Target**: Multifarma Launch (March 2026)
**Source**: TODO.md, UAT Feedback 2026-02-24

---

## In Progress

### UAT-1: Onboarding wrong text on certain steps
**Priority**: MEDIUM | **Status**: NO ISSUES FOUND - NEEDS CLARIFICATION
- [x] Reviewed all onboarding text after Goede Gewoontes refactor
- [x] Tour steps, welcome screen, wizard steps all correct
- [x] "Goede gewoontes" correctly referenced as standalone feature
- [ ] Ask tester for specific steps/screenshots
- **Note**: "Goede gewoontes" goal silently filtered from goal selection (no explanation shown)

### UAT-2: Recalculating program (edit program) not working ✅
**Priority**: HIGH | **Status**: FIXED
- [x] Added error handling to `useRegenerateSchedule` hook (toast on error)
- [x] Added try-catch in ProgramEditDialog.handleRegenerate
- [x] Root cause: `regenerate-schedule.ts` Airtable-only, rejects UUID program IDs
- [x] Implemented full postgres_primary path in `regenerate-schedule.ts`
- [x] Build verified clean

### UAT-3: Program name not sent to Airtable ✅
**Priority**: HIGH | **Status**: FIXED
- [x] Root cause: `upsertProgram()` in `airtable-writers.ts` missing `name` field
- [x] Added `if (payload.name) { fields[PROGRAM_FIELDS.name] = payload.name }` to airtable-writers.ts

### UAT-4: Personal goals registration broken (only 1 or none) ✅
**Priority**: HIGH | **Status**: FIXED
- [x] Root cause 1: Single shared mutation disabled ALL goal buttons during any mutation
- [x] Fix: Per-goal pending tracking via `pendingGoalIds` Set in PersonalGoalsSection
- [x] Root cause 2: Missing UNIQUE constraint on personal_goal_usage_pg
- [x] Fix: Migration 015_personal_goal_usage_unique.sql
- [x] Root cause 3: Cache not reconciled after success (onSuccess didn't invalidate personalGoalUsage)
- [x] Fix: onSuccess now invalidates personalGoalUsage query key
- [x] Error toast added for visibility

---

## Goede Gewoontes Feature (NEW - Uncommitted)

### GG-1: Core Implementation ✅ AUDIT PASSED
**Status**: Implementation complete, needs deploy
- [x] Database migration 014_goede_gewoontes.sql (reference + usage tables)
- [x] Field mappings for both Airtable tables (correct IDs verified)
- [x] New repo: goede-gewoonte-usage-repo.ts (CRUD operations)
- [x] Reference repo additions (listAllGoedeGewoontes, lookupByIds)
- [x] User repo additions (updateUserGoedeGewoontes, getUserGoedeGewoontes)
- [x] API endpoint refactored: habit-usage/index.ts (goedeGewoonteId instead of methodId)
- [x] API endpoint: methods/habits.ts (returns user's selected goede gewoontes)
- [x] Airtable sync: writers + full-sync for goede gewoontes
- [x] Outbox entity type: "goede_gewoonte_usage"
- [x] Frontend: GoodHabitsSection.tsx with optimistic updates
- [x] Frontend: React Query hooks with optimistic cache updates
- [x] User nuke includes goede_gewoontes_usage_pg cleanup
- [x] Rewards system counts goede gewoonte usage

### GG-2: AI Integration ✅ VERIFIED
- [x] AI schema includes `selectedGoedeGewoontes` array
- [x] System prompt instructs: "Selecteer maximaal 3 goede gewoontes"
- [x] Program generation data loads all goede gewoontes from reference table
- [x] Generate endpoint returns selectedGoedeGewoontes in response
- [x] Confirm endpoint saves selected IDs to user's goede_gewoontes column

### GG-3: Frontend Onboarding Integration ✅ IMPLEMENTED
**Status**: Implementation complete, needs deploy
- [x] preview.ts passes goedeGewoontes to AI buildSystemPrompt
- [x] preview.ts maps AI selections and returns suggestedGoedeGewoontes in response
- [x] AIPreviewResult type includes suggestedGoedeGewoontes
- [x] AIGenerateResult type includes selectedGoedeGewoontes (for ProgramResult display)
- [x] AIPreviewResponse type updated with reason field
- [x] handleConfirm passes selectedGoedeGewoontes to confirm endpoint
- [x] ProgramResult.tsx displays AI-selected goede gewoontes with name + reason
- [x] i18n translations added (nl/fr/en) for goedeGewoontes.title
- [x] Max 3 selection enforced by AI schema (selectedGoedeGewoontes max items)
- [ ] End-to-end test: verify goede gewoontes display after program creation

### GG-4: Pending Items
- [ ] Run migration 014 on production database
- [ ] Verify Airtable field name "Programma's" matches actual table (field-mappings.js:399)
- [ ] Add test coverage for goede-gewoonte-usage-repo.ts
- [ ] Test full sync cycle: Postgres -> Airtable -> Postgres

---

## Previously Completed

- [x] **CB-1**: Blue screen after program creation - Not a bug
- [x] **CB-2**: Points incorrectly awarded - Fixed double counting
- [x] **CB-3**: Progress resets to 0% on recalculation - Preserved method_usage
- [x] **M-1**: Improve Onboarding and UX Clarity (2026-02-03)
- [x] **M-2**: Replace plus icon with checkmark
- [x] **M-3**: Improve Overlap Warning Text Clarity (2026-02-03)
- [x] **M-4**: Fix Video Auto-Fullscreen on Mobile (2026-02-03)
- [x] **BUG**: Missing personal-goals routes in server.ts

---

## Blocked

- **M-5** (AI Method Selection) and **M-6** (Training Time) blocked by **C-1** (Content Audit)

---

## Content & Business (Non-Technical)

### C-1: Content Audit and Completion [URGENT BLOCKER]
**Owner**: Content Team
- [ ] Define complete list of methods for MVP
- [ ] Fill in all Airtable fields: duration, goal linkage, media

---

## Testing

### T-1: Add Test Users
- [ ] Add Dominique, Geert to Airtable
- [ ] Share test credentials

### T-2: Pilot Testing (Prana)
- [ ] Select small engaged group
- [ ] Onboard pilot users
- [ ] Collect feedback

---

## Deferred (Post-Launch)

- S-1: AI-Generated Program Names
- S-2: Add Method from Library to Program
- S-3: PWA Re-login (known limitation)
- N-1: User Levels (Beginner/Advanced)
- N-2: Score Reset After 3 Months
- F-1: HR Dashboard
- F-2: Native App Migration
