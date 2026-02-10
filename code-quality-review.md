# Code Quality and Obsolete Code Review

Date: 2026-02-05
Scope: `api/`, `src/`, `server.ts`

## Summary
The codebase is generally clean and consistent, but there are several deprecated paths still in active use and a few quality issues: repeated “fetch all and filter in JS” patterns, inconsistent input validation, and TODOs that affect data correctness or UX. There are also legacy fields (`programId`) that should be removed or fully migrated.

## Obsolete or Legacy Code Paths
1. Deprecated `programId` in method usage
- Evidence:
  - `api/method-usage/index.ts` (body accepts `programId` with deprecation comment)
  - `api/_lib/field-mappings.js` (`METHOD_USAGE_FIELDS.program` marked DEPRECATED)
  - `src/types/program.ts` (`MethodUsage.programId` DEPRECATED)
  - `src/pages/MethodDetailPage.tsx` uses `programId` fallback
- Impact: Dual pathways create ambiguity and increase maintenance burden.
- Suggested improvement:
  - Remove `programId` fallback in API and client after confirming all consumers use `programmaplanningId`.
  - Add a migration step or server-side mapping if needed.

2. Deprecated progress calculation
- Evidence: `src/types/program.ts` uses deprecated `getActivityProgress()`.
- Impact: Dead/obsolete logic risks reintroduction in UI.
- Suggested improvement:
  - Remove `getActivityProgress()` and any unused references.
  - Ensure all callers use `getSessionProgress()`.

## Code Quality Findings and Improvements

1. Repeated “fetch all then filter in JS” patterns (performance / cost)
- Evidence:
  - `api/programs/index.ts` fetches all programs and schedules and filters in JS
  - `api/habit-usage/index.ts` and `api/personal-goal-usage/index.ts` fetch all usage rows
  - `api/programs/[id].ts` fetches all programmaplanning records
- Impact: Scales poorly with data size and increases Airtable API usage.
- Suggested improvement:
  - Centralize Airtable filtering helpers to safely build `filterByFormula` and reduce full-table scans.
  - For linked record filtering, consider storing denormalized fields (e.g., `userId`) that are formula-safe.

2. Inconsistent input validation
- Evidence:
  - Some endpoints validate record IDs (`isValidRecordId`), others do not.
  - `api/users/lookup.ts` uses raw `email` in formula (no escaping).
- Impact: Inconsistent correctness and vulnerability exposure.
- Suggested improvement:
  - Add a shared validation layer for IDs and formula inputs; enforce it across handlers.

3. TODOs that affect feature completeness
- Evidence: `src/pages/MethodDetailPage.tsx` has TODO to update usage remark.
- Impact: UX mismatch (user feedback not persisted).
- Suggested improvement:
  - Add an endpoint to update method usage remark, or remove the UI path if not planned.

4. Auth and API middleware duplication
- Evidence: Many endpoints repeat `Authorization` parsing and JWT verification.
- Impact: Verbose handlers, higher chance of mistakes.
- Suggested improvement:
  - Introduce a middleware (or handler wrapper) that validates auth and injects `payload`.
  - Standardize response error messages and status codes.

5. Hardcoded magic link fallback domain
- Evidence: `api/auth/magic-link.ts` uses `process.env.APP_URL || "https://mfa.drvn.be"`.
- Impact: Unexpected URLs in non-prod environments.
- Suggested improvement:
  - Require `APP_URL` in production and fail fast if missing.
  - Use environment-specific defaults via config.

## Suggestions for Cleanup Tasks
1. Remove deprecated `programId` pathway once migration completes.
2. Delete `getActivityProgress()` if unused.
3. Add shared helpers for Airtable queries and input validation.
4. Create an API endpoint for updating method usage remarks (or remove the UI prompt).
5. Consolidate auth verification into shared middleware.

## Test Gaps
- No static analysis or lint checks were run.
- No usage-based analysis to confirm whether deprecated paths are still used.
