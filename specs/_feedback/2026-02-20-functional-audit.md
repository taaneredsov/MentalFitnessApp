# App Functional Audit (2026-02-20)

## Scope
Audit of functional and responsiveness issues across:
- Persoonlijke doelen
- Overtuigingen
- Methodes (incl. Programma flows)

Target architecture assumption: Postgres-first (`postgres_primary`) with Airtable async sync only.

## Executive Summary
You are partly correct that frontend state management contributes to UX instability, but it is not the core root cause.

Primary issues are architectural drift from Postgres-first:
1. Some high-traffic endpoints still read directly from Airtable.
2. One full-sync path can materialize duplicate personal goals in Postgres.
3. Some wizard/program flows still depend on Airtable automation polling.

Frontend state/query issues exist, but they amplify backend inconsistency rather than causing it alone.

## Findings

### 1) High: `GET /api/methods` bypasses Postgres mode entirely
- File: `api/methods/index.ts:1`
- Behavior: Always uses `cachedSelect(...Airtable...)`; no `DATA_BACKEND_METHODS` check.
- Impact:
  - Slower first-load behavior (Airtable read path).
  - Inconsistent source-of-truth vs other method endpoints that do support Postgres mode.
  - Can surface stale or diverging data and make UI feel inconsistent/unresponsive.

### 2) High: `GET /api/overtuigingen` bypasses Postgres mode entirely
- File: `api/overtuigingen/index.ts:1`
- Behavior: Always Airtable via cached select; no backend-mode routing.
- Impact:
  - Same responsiveness/consistency issue as methods.
  - Overtuigingen UI can lag or reflect stale state relative to Postgres-backed usage/progress endpoints.

### 3) High: Personal goals can duplicate in Postgres during full Airtable poll sync
- Files:
  - `api/_lib/sync/full-sync.ts:131`
  - `tasks/db/migrations/001_postgres_airtable_async_sync.sql:82`
- Behavior:
  - Full sync inserts `personal_goals_pg.id = Airtable RECORD_ID()`.
  - Postgres-created goals use UUID ids (`reference-repo.ts` create path).
  - `personal_goals_pg` has no `airtable_record_id` to reconcile identities.
- Impact:
  - Same logical goal can exist twice under different IDs.
  - UI symptoms: “goals show twice”, inconsistent completion counters, odd account/home list behavior.

### 4) High: Program Wizard still relies on Airtable automation polling for methods
- Files:
  - `src/components/ProgramWizard/index.tsx:68`
  - `api/programs/[id]/methods.ts:1`
- Behavior:
  - Wizard polls `/api/programs/:id/methods` for suggested methods.
  - Endpoint is Airtable-only.
- Impact:
  - Slow/fragile onboarding/edit flow in a Postgres-first system.
  - “Methodes not always working” is expected when Airtable automation or propagation is delayed.

### 5) Medium: Overtuigingen API paths are mixed-source by design in UI composition
- File: `src/components/OvertuigingenSection.tsx:54`
- Behavior:
  - UI unions local filtering from `/overtuigingen` with `/overtuigingen/by-goals`.
  - This was added as mixed-backend mitigation.
- Impact:
  - If one source is stale/slower, the merge can cause transient mismatch and perceived flakiness.
  - Not necessarily duplicate IDs (dedup by map key exists), but still unstable UX in edge timing windows.

### 6) Medium: Frontend invalidation patterns are mostly correct but not sufficient against data drift
- File: `src/hooks/queries.ts:370+`
- Behavior:
  - Query invalidations are present for key mutations.
  - However, they cannot fix duplicate rows produced in backend sync/materialization.
- Impact:
  - User may still see duplicated/ghost entries despite proper cache invalidation.

### 7) Medium: Non-Postgres persoonlijke overtuigingen endpoints remain Airtable-only
- File: `api/persoonlijke-overtuigingen/index.ts:1`
- Behavior: No Postgres mode for this feature.
- Impact:
  - In a Postgres-first app this remains a slow/variable island and can contribute to “not always working” reports.

## Is “state management is the core issue” correct?
Partially.

- Correct: there are frontend-state timing windows and mixed-query composition that can make issues visible.
- Not correct as primary root cause: the larger cause is backend source inconsistency (Airtable reads in critical paths + duplicate materialization in full sync).

## Immediate Stabilization Priorities
1. Move `/api/methods` and `/api/overtuigingen` to backend-mode routing with Postgres-primary support.
2. Fix personal-goal identity reconciliation:
   - Add `airtable_record_id` to `personal_goals_pg` (or equivalent mapping strategy),
   - Update full sync to upsert by mapped identity, not raw Airtable record id as primary key.
3. Remove Airtable-automation dependency from Program Wizard method suggestion flow in Postgres mode.
4. Keep Airtable as async sink only; avoid direct Airtable reads for user-facing hot paths in production.

## Secondary Frontend Hardening
1. Add explicit optimistic reconciliation for personal goals list mutations (create/complete/reactivate/delete).
2. Add user-visible error messaging for completion/create failures (currently many onError paths are silent).
3. Add end-to-end tests for:
   - personal goal create + refresh (no duplicates),
   - overtuiging complete flows,
   - program wizard method suggestion in Postgres mode.

## Evidence References
- `api/methods/index.ts:1`
- `api/overtuigingen/index.ts:1`
- `api/_lib/sync/full-sync.ts:131`
- `tasks/db/migrations/001_postgres_airtable_async_sync.sql:82`
- `src/components/ProgramWizard/index.tsx:68`
- `api/programs/[id]/methods.ts:1`
- `src/components/OvertuigingenSection.tsx:54`
- `src/hooks/queries.ts:370`
- `api/persoonlijke-overtuigingen/index.ts:1`
