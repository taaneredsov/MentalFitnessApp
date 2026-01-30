# Action Required: Personal Goals

Manual steps that must be completed by a human.

## Before Implementation

- [x] **Create Airtable tables** - Tables already created by user:
  - Personal Goals: `tblbjDv35B50ZKG9w`
  - Personal Goal Usage: `tbl8eJeQtMnIF5EJo`

- [x] **Get Airtable field IDs** - Field IDs retrieved and added to field-mappings.js

## Known Issues (2026-01-30)

- [ ] **BUG: Score registration not working** - Personal goal completions are not being saved. Debug steps:
  1. Check browser console for error messages
  2. Check Vercel dev server logs for API errors
  3. Verify Airtable field IDs are correct
  4. Test API directly via curl

## After Implementation

- [ ] **Test in production** - Verify feature works on deployed app after deployment

---

> **Note:** The personal goals feature was implemented but the score registration is not working. This is the #1 priority bug to fix before Friday demo.
