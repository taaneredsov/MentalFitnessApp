# Action Required: Activity-based Program Progress

Manual steps that must be completed by a human before implementation.

## Prerequisites

This spec depends on **method-usage-tracking** being updated first:

- [ ] **Complete method-usage-tracking Airtable changes**
  - Add Programmaplanning link to Method Usage table
  - Verify bidirectional link with Programmaplanning.methodUsage
  - See `specs/method-usage-tracking/action-required.md`

## Before Implementation

- [ ] **Verify Programmaplanning table has methodUsage field**
  - Table: Programmaplanning (tbl2PHUaonvs1MYRx)
  - Field: Methodegebruik (`fldoxGlLYZ5NI60hl`)
  - Should link to Method Usage table

- [ ] **Verify Programs have Programmaplanning records**
  - AI-generated programs should have Programmaplanning records
  - Check a sample program to confirm schedule exists

## During Implementation

None required - all implementation is automated.

## After Implementation

- [ ] **Test progress calculation**
  1. Create a program with AI-generated schedule
  2. Verify progress shows 0% initially
  3. Complete a method from the schedule
  4. Verify progress increases appropriately
  5. Verify "X van Y sessies voltooid" text is accurate

---

> **Note:** Implementation order:
> 1. First: `method-usage-tracking` (Airtable changes + code)
> 2. Then: `activity-based-progress` (depends on above)
