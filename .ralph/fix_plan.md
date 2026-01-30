# Fix Plan - Friday Demo Sprint

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked

---

## Priority 1: CRITICAL - Personal Goals Bug Fix

**Goal**: Fix the personal goals score registration so completions are saved to Airtable.

### Debug Tasks
- [~] Check Vercel dev server logs for API errors when completing a goal
  - Enhanced logging added to API endpoint
- [x] Verify Airtable field IDs in `api/_lib/field-mappings.js` match actual table
  - Verified: All field IDs (PERSONAL_GOAL_USAGE_FIELDS, PERSONAL_GOAL_FIELDS, USER_FIELDS) are correct
- [x] Test API directly with curl to isolate frontend vs backend issue
  - Direct Airtable API calls work (create records, update bonusPoints)
  - API endpoint responds correctly (returns proper JSON errors)
- [~] Check if the error alert (added for debugging) shows any message
  - Enhanced error alert with more details (shows userId, goalId, date)

### Investigation Summary
- All Airtable operations work when called directly via curl
- Field IDs are verified correct against actual Airtable schema
- API endpoint is reachable and returns proper JSON responses
- Need user to test in app to see error details via alert

### Fix Tasks (based on diagnosis)
- [~] Fix identified issue in `api/personal-goal-usage/index.ts`
  - Added comprehensive logging to trace request flow
- [ ] Verify fix works by completing a goal and checking Airtable
- [ ] Remove debug alert from `src/components/PersonalGoalsSection.tsx`

### Verification
- [ ] Complete a personal goal via UI
- [ ] Verify record created in Airtable `Persoonlijk doelgebruik` table
- [ ] Verify count updates in UI without refresh

---

## Priority 2: One Active Program Limit

**Goal**: Prevent users from having more than one running program at a time.

### Implementation Tasks
- [x] Add `hasRunningProgram()` helper to `src/types/program.ts`
- [x] Add `getRunningProgram()` helper to `src/types/program.ts`
- [x] Update `src/pages/HomePage.tsx` to check for running program before showing wizard
- [x] Create blocking message UI when user has running program
- [x] Add backend validation in program creation API (409 Conflict response)

### Verification
- [ ] User with running program sees "active program" message instead of wizard
- [ ] Message includes link to current program
- [ ] API returns 409 when trying to create program with one already running

---

## Priority 3: STRETCH - Score Split Display

**Goal**: Display 3 separate score widgets on HomePage.

### Prerequisites (ACTION REQUIRED - Human)
- [ ] Add `Mental Fitness Score` field to Gebruikers table in Airtable
- [ ] Add `Persoonlijke Doelen Score` field to Gebruikers table
- [ ] Add `Goede Gewoontes Score` field to Gebruikers table
- [ ] Update `Totaal Punten` formula
- [ ] Document new field IDs

### Implementation Tasks (after prerequisites)
- [ ] Update `api/_lib/field-mappings.js` with new field IDs
- [ ] Update `transformUserRewards()` to include split scores
- [ ] Update `src/types/rewards.ts` with new fields
- [ ] Create `src/components/ScoreWidgets.tsx` component
- [ ] Add ScoreWidgets to HomePage
- [ ] Update point-awarding APIs to use category-specific score fields

### Verification
- [ ] Three score widgets display on HomePage
- [ ] Each shows correct score
- [ ] Completing activities updates correct category

---

## Completion Checklist

Before signaling EXIT:
- [ ] Priority 1 complete (personal goals bug fixed)
- [ ] Priority 2 complete (one active program limit)
- [ ] TypeScript compiles: `npm run build`
- [ ] All changes committed to git
- [ ] Push to GitHub

---

## Notes

- Spec files: `specs/personal-goals/`, `specs/one-active-program-limit/`, `specs/score-split-display/`
- Roadmap: `TODO.md`
- User will manage Airtable schema changes for Priority 3
