# Implementation Review: Postgres-Airtable Async Sync

**Date:** 2026-02-10
**Reviewer:** Claude Opus 4.6 (automated audit)
**Scope:** Full codebase audit against requirements.md and implementation-plan.md

---

## Executive Summary

The implementation is **substantially complete** with solid foundational work across schema, sync engine, repositories, and API migration. The core architecture is production-ready for a phased cutover. Key gaps remain in observability, testing, and a few unmigrated endpoints.

**Overall: ~90% complete across all phases.** Cutover to `postgres_primary` completed on 2026-02-20.

---

## Phase-by-Phase Status

| Phase | Description | Status | Completeness |
|-------|-------------|--------|--------------|
| 0 | Design Lock | Done | 100% |
| 1 | Foundation (deps, docker, env) | Done | 100% |
| 2 | Schema & Migrations | Done | 100% |
| 3 | Sync Engine | Done | 90% |
| 4 | Repository Layer | Done | 95% |
| 5 | API Migration | Done | 95% |
| 6 | Cutover Strategy (feature flags) | Done | 100% |
| 7 | Testing & Observability | Gaps | 15% |
| 8 | Post-Cutover Cleanup | Not Started | 0% |

---

## What's Working Well

### Foundation (Phase 1-2) - COMPLETE
- `pg` v8.18.0 with direct parameterized queries (no ORM overhead)
- `docker-compose.yml` (production) and `docker-compose.local.yml` with Postgres 16, Redis 7, worker service
- `.env.example` with all required vars: `DATABASE_URL`, pool config, feature flags, sync config
- 2 migration files covering all 15 tables + proper indexes
- `api/_lib/db/client.ts` with pool management, `withDbTransaction()`, SSL support
- `tasks/db-migrate.mjs` migration runner with `schema_migrations` tracking

### Schema - ALL TABLES PRESENT
**Operational:** `users_pg`, `programs_pg`, `program_schedule_pg`, `method_usage_pg`, `habit_usage_pg`, `personal_goals_pg`, `personal_goal_usage_pg`
**Reference:** `reference_methods_pg`, `reference_goals_pg`, `reference_days_pg`
**Sync:** `airtable_id_map`, `sync_outbox`, `sync_dead_letter`, `sync_checkpoint`, `sync_inbox_events`

### Sync Engine (Phase 3) - SOLID
- **Outbound:** Outbox pattern with idempotency keys, `enqueueSyncEvent()` in same transaction as writes
- **Worker:** Poll-based with `FOR UPDATE SKIP LOCKED`, exponential backoff (`delay = base * attempt^2`), dead-letter after max retries
- **Airtable Writers:** Entity-specific upserts for all 6 types with `RetryableSyncError` classification
- **Inbound - User Fast-Lane:** Webhook handler at `/api/sync/inbound.ts`, dedup via `sync_inbox_events`, read-through fallback for auth
- **Inbound - Full Sync:** Complete Airtable-to-Postgres backfill for all tables, periodic poll (120s default)
- **ID Mapping:** Bidirectional `airtable_id_map` with helpers

### Repositories (Phase 4) - 7 FILES
- `api/_lib/repos/program-repo.ts` (comprehensive: CRUD, progress computation, date overlap validation)
- `api/_lib/repos/user-repo.ts` (extended with bonusPoints/badges/level, incrementUserBonusPoints, getUserRewardsData)
- `api/_lib/repos/habit-usage-repo.ts`
- `api/_lib/repos/method-usage-repo.ts`
- `api/_lib/repos/personal-goal-usage-repo.ts`
- `api/_lib/repos/overtuiging-usage-repo.ts` (createOvertuigingUsage with ON CONFLICT, find, list by user, list by user+program)
- `api/_lib/repos/streak-utils.ts`

### Feature Flags (Phase 6) - WORKING
- `api/_lib/data-backend.ts` with modes: `airtable_only` | `postgres_shadow_read` | `postgres_primary`
- Per-endpoint flags: `DATA_BACKEND_PROGRAMS`, `DATA_BACKEND_HABIT_USAGE`, `DATA_BACKEND_METHOD_USAGE`, `DATA_BACKEND_PERSONAL_GOAL_USAGE`, `DATA_BACKEND_OVERTUIGING_USAGE`, `DATA_BACKEND_REWARDS`
- Boolean flags: `USER_FAST_LANE_ENABLED`, `USER_READTHROUGH_FALLBACK_ENABLED`, `FULL_AIRTABLE_POLL_SYNC_ENABLED`

---

## Gaps & Missing Items

### HIGH PRIORITY (Blocking Production Cutover)

#### ~~1. Unmigrated Endpoints~~ -- RESOLVED
All operational endpoints now have Postgres paths with feature flag routing.

*Previously listed `api/method-usage/by-program.ts`, `api/rewards/index.ts`, and `api/overtuiging-usage/index.ts` -- all now migrated. `by-program.ts` uses `listLatestByProgram()` from method-usage-repo + `getProgramByAnyId()` from program-repo, routed via `DATA_BACKEND_METHOD_USAGE` flag.*

#### 2. ~~Missing `overtuiging_usage_pg` Table~~ -- RESOLVED
Migration `003_overtuiging_usage_and_reward_columns.sql` created. Table `overtuiging_usage_pg` with UUID PK, user_id FK, overtuiging_id, program_id (nullable), usage_date, airtable_record_id (UNIQUE), timestamps, UNIQUE(user_id, overtuiging_id), index on user_id. Also ALTERs `users_pg` adding bonus_points, badges, level columns.

#### 3. ~~Missing `overtuiging-usage-repo.ts`~~ -- RESOLVED
Created `api/_lib/repos/overtuiging-usage-repo.ts` with createOvertuigingUsage (INSERT ON CONFLICT DO NOTHING), findOvertuigingUsage, listOvertuigingUsageByUser, listOvertuigingUsageByUserAndProgram.

#### 4. No Observability / Metrics
Zero metrics collection. Cannot monitor sync health during cutover:
- No outbox queue depth tracking
- No sync lag measurement
- No dead-letter rate alerting
- No user provisioning SLO monitoring (spec requires <=15s p95, <=60s p99)
- No endpoint latency comparison (Airtable vs Postgres)

**Minimum viable:** Add a `/api/health/detailed` endpoint that returns:
```json
{
  "db": "ok",
  "outbox_pending": 12,
  "outbox_oldest_seconds": 3,
  "dead_letter_count": 0,
  "last_full_sync": "2026-02-10T10:30:00Z"
}
```

#### 5. No Test Coverage for Sync System
- 0 tests for repositories, sync engine, worker, outbox, ID mapping
- Existing tests (~30k LOC) cover field-mappings, JWT, security only
- Framework is configured (Vitest + Playwright) but no sync-related tests exist

### MEDIUM PRIORITY (Pre-Production)

#### 6. Shadow Reads Incomplete
Only `api/programs/index.ts` has shadow read support. Missing from:
- `api/habit-usage/index.ts`
- `api/method-usage/index.ts`
- `api/personal-goal-usage/index.ts`

Without shadow reads on these endpoints, there's no way to verify data parity before switching to `postgres_primary`.

#### 7. `sync_checkpoint` Table Unused
Table exists in schema but no code reads/writes checkpoint cursors. Full sync always polls all records. Not blocking but inefficient at scale.

#### 8. ~~No Backfill Validation~~ -- RESOLVED
Created `tasks/validate-backfill.mjs` that compares row counts across 7 tables between Airtable and Postgres, reports discrepancies, exits code 1 if any found. Added `npm run validate:backfill` script.

#### 9. ~~Health Endpoint Too Basic~~ -- RESOLVED
Enhanced `/api/health` with Postgres connectivity check (SELECT 1), sync_outbox stats (pending count, oldest pending age, dead_letter count). Returns 200 healthy / 503 degraded.

#### 10. No CI/CD Pipeline
No `.github/workflows/` directory. No automated test runs, migration validation, or build checks on PR.

### LOW PRIORITY (Post-Cutover)

#### 11. Structured Logging
Console.log/console.error only. No JSON structured logging, no correlation IDs, no log levels.

#### 12. Missing Runbooks
No documented procedures for: sync worker failure, outbox backup, dead-letter replay, SLO violations, emergency rollback.

#### 13. Missing Repositories (Non-Critical)
- No dedicated `personal-goals-repo.ts` (works via full-sync currently)
- No dedicated `reference-repo.ts` (read-only data, works via full-sync)

#### 14. No Rollback Verification
Spec requires confirming feature flags can safely revert. No automated test exists for flag toggling.

---

## Migrated vs. Unmigrated Endpoints

### Migrated (Postgres path available via feature flag)
- `api/programs/index.ts` (GET, POST)
- `api/programs/[id].ts` (GET, PATCH, DELETE)
- `api/programs/[id]/schedule/[planningId].ts`
- `api/habit-usage/index.ts` (GET, POST, DELETE)
- `api/method-usage/index.ts` (POST, PATCH)
- `api/method-usage/by-program.ts` (GET with listLatestByProgram)
- `api/personal-goal-usage/index.ts`
- `api/overtuiging-usage/index.ts` (GET, POST with streak + bonus points + outbox sync)
- `api/rewards/index.ts` (GET with computed totalPoints/scores from usage counts)
- `api/auth/login.ts` (user read-through fallback)
- `api/auth/me.ts`, `api/auth/refresh.ts`, `api/auth/set-password.ts`

### Not Migrated (Airtable-only)
- `api/methods/[id].ts`, `api/methods/habits.ts` (reference data)
- `api/overtuigingen/by-goals.ts` (reference data)
- `api/companies/lookup.ts`
- `api/personal-goals/index.ts` (CRUD, not usage)

---

## Architecture Decisions Made (vs. Spec)

| Decision | Spec Suggested | Actual | Assessment |
|----------|---------------|--------|------------|
| ORM | TBD (Phase 0) | None - raw `pg` queries | Good: simpler, less overhead |
| Queue | TBD (BullMQ mentioned) | Poll-based from `sync_outbox` table | Good: no Redis dependency for sync |
| Inbound sync | Webhook + poll | Webhook (users) + periodic poll (all) | Good: pragmatic approach |
| ID strategy | TBD | UUID primary keys + `airtable_id_map` | Good: clean separation |
| User auth | - | Read-through fallback to Airtable | Good: safety net for auth |

---

## Recommended Next Steps (Priority Order)

### Post-Cutover (Recommended)
1. Write integration tests for sync worker (claim, retry, dead-letter)
2. Write unit tests for all repositories (7 repo files)
3. Add basic metrics/observability dashboard (outbox depth, sync lag, dead-letter trends)

### Done (Completed Items)
- ~~Enable `postgres_primary` for all operational endpoints~~ -- done (2026-02-20). All backends except `DATA_BACKEND_OVERTUIGINGEN` (remains `airtable_only`, read-only cached)
- ~~Test feature flag rollback on staging~~ -- done
- ~~Add migration 003: `overtuiging_usage_pg` table~~ -- done
- ~~Create `overtuiging-usage-repo.ts`~~ -- done
- ~~Migrate `api/overtuiging-usage/index.ts` with feature flag~~ -- done
- ~~Migrate `api/rewards/index.ts` to read from Postgres user table~~ -- done
- ~~Migrate `api/method-usage/by-program.ts` with Postgres path~~ -- already done (uses `listLatestByProgram` + `getProgramByAnyId`)
- ~~Add detailed health endpoint with DB/queue checks~~ -- done
- ~~Create backfill validation script (row counts + sample checks)~~ -- done (`npm run validate:backfill`)

### Post-Cutover
6. Implement checkpoint-based incremental sync (replace full polls)
7. Add structured logging with correlation IDs
8. Create operational runbooks
9. Set up CI/CD pipeline with migration validation
10. Review and tune worker concurrency based on production load
