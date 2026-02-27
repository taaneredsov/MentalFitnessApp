# Implementation Review: Postgres-Airtable Async Sync

**Last updated:** 2026-02-27
**Scope:** Post-cleanup audit reflecting removal of data backend toggle system

---

## Executive Summary

The migration is **complete**. All API endpoints use Postgres exclusively. The data backend toggle system (`DataBackendMode`, `DATA_BACKEND_*` env vars, `getDataBackendMode`, `isPostgresPrimary`, `isPostgresShadowRead`, `cachedSelect`, `cached-airtable.ts`) has been fully removed. Airtable is now sync-only.

**Overall: ~95% complete.** Remaining gaps are in observability and testing.

---

## Phase Status

| Phase | Description | Status | Completeness |
|-|-|-|-|
| 1-2 | Foundation, Schema & Migrations | Done | 100% |
| 3 | Sync Engine (outbound + inbound) | Done | 95% |
| 4 | Repository Layer (9 repos) | Done | 100% |
| 5 | API Migration (all endpoints) | Done | 100% |
| 6 | Cutover & Cleanup | Done | 100% |
| 7 | Testing & Observability | Gaps | 15% |

---

## Current Architecture

```text
3-Lane Sync:
  1. Inbound:    Airtable -> full-sync poller -> Postgres (users, reference data, translations)
  2. Fast-Lane:  Airtable -> webhook -> Postgres (user create/update events)
  3. Outbound:   Postgres -> sync_outbox -> worker -> Airtable (user-generated data)

All API endpoints: PWA -> API -> Postgres only
```

---

## What Was Removed (Cleanup)

- `api/_lib/data-backend.ts` (DataBackendMode, getDataBackendMode, isPostgresPrimary, isPostgresShadowRead)
- All `DATA_BACKEND_*` env vars (PROGRAMS, HABIT_USAGE, METHOD_USAGE, etc.)
- All `handleGetAirtable`/`handlePostAirtable` code paths in every endpoint
- `cachedSelect` and `cached-airtable.ts`
- `shouldUsePostgresRewards` and `awardAirtable` in rewards engine
- `full-sync.ts` no longer syncs user-generated/tracking data from Airtable
- Boolean flags: `USER_FAST_LANE_ENABLED`, `USER_READTHROUGH_FALLBACK_ENABLED`, `FULL_AIRTABLE_POLL_SYNC_ENABLED` (features are now always-on)

---

## Remaining Gaps

### Testing (HIGH)
- 0 tests for repositories, sync engine, worker, outbox, ID mapping
- Existing tests cover field-mappings, JWT, security, program utilities only

### Observability (MEDIUM)
- Health endpoint reports basic DB/outbox stats
- No dashboards, no alerting, no structured logging
- No user provisioning SLO monitoring

### Operations (LOW)
- No runbooks for sync failures, dead-letter replay, emergency procedures
- No checkpoint-based incremental sync (full polls only)

---

## All Migrated Endpoints

All endpoints below use Postgres directly (no toggle, no Airtable fallback for reads/writes):

**Programs:** `index.ts` (GET/POST), `[id].ts` (GET/PATCH/DELETE), `[id]/schedule/[planningId].ts`, `[id]/methods` (GET), `generate.ts`, `preview.ts`, `confirm.ts`
**Usage:** `habit-usage/index.ts`, `method-usage/index.ts`, `method-usage/by-program.ts`, `personal-goal-usage/index.ts`, `overtuiging-usage/index.ts`
**Reference:** `methods/index.ts`, `goals/index.ts`, `days/index.ts`, `mindset-categories/index.ts`, `overtuigingen/index.ts`, `companies/lookup.ts`
**User data:** `persoonlijke-overtuigingen/index.ts`, `rewards/index.ts`
**Auth:** `login.ts`, `me.ts`, `refresh.ts`, `set-password.ts`, `magic-link.ts`, `verify-code.ts`
**Other:** `translations/[lang].ts`

---

## Recommended Next Steps

1. Write integration tests for sync worker (claim, retry, dead-letter)
2. Write unit tests for all 9 repository files
3. Add observability dashboard (outbox depth, sync lag, dead-letter trends)
4. Implement checkpoint-based incremental sync
5. Add structured logging with correlation IDs
6. Create operational runbooks
