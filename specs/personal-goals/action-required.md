# Action Required: Personal Goals

Manual steps that must be completed by a human.

## Before Implementation

- [x] **Create Airtable tables** - Tables already created by user:
  - Personal Goals: `tblbjDv35B50ZKG9w`
  - Personal Goal Usage: `tbl8eJeQtMnIF5EJo`

- [x] **Get Airtable field IDs** - Field IDs retrieved and added to field-mappings.js

## Resolved Issues

- [x] **BUG: Score registration not working** (reported 2026-01-30, fixed 2026-02-20)
  - **Root cause**: `awardRewardActivity()` (introduced in commit `1d57506`) fetches 5 Airtable tables to calculate reward counts. If this call fails (timeout, rate limit), the entire POST request failed — even though the usage record was already created.
  - **Fix**: Wrapped `awardRewardActivity()` in try/catch in both `handlePostPostgres` and `handlePostAirtable`. A reward engine failure now logs a warning but no longer prevents the completion from succeeding.

## After Implementation

- [x] **Test in production** - Feature works on deployed app
