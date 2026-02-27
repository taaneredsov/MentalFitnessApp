# Action Required: Activity-based Program Progress

Manual steps that must be completed by a human.

## Outstanding

- [ ] **Verify Programmaplanning link in method-usage-tracking**
  - Depends on Airtable schema change in `specs/method-usage-tracking/action-required.md`
  - Once the Programmaplanning link field is added, outbox sync will propagate it to Airtable

- [ ] **Test progress calculation end-to-end**
  1. Create a program with AI-generated schedule
  2. Verify progress shows 0% initially
  3. Complete a method from the schedule
  4. Verify progress increases and "X van Y sessies voltooid" is accurate

## Completed

- [x] Session counts (`totalSessions`, `completedSessions`) returned from Postgres in program API responses.
- [x] `getSessionProgress()` utility function implemented.
- [x] HomePage and ProgramCard use activity-based progress.
- [x] ProgramDetailPage shows schedule with completion status.
- [x] All schedule/progress reads come from Postgres (no Airtable direct reads).
