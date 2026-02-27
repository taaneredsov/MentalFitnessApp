# Implementation Plan: Postgres Primary DB + Async Airtable Sync

## Overview

All hot operational paths have been migrated from Airtable to Postgres. The data backend toggle system (`DataBackendMode`, `DATA_BACKEND_*` env vars, `getDataBackendMode`, `isPostgresPrimary`, etc.) has been fully removed. All endpoints now use Postgres directly.

## Current Architecture

```text
PWA -> API -> Postgres (all reads/writes)
             -> Outbox events (same transaction)

Sync Worker -> reads outbox -> Airtable API (async, outbound)

Full-Sync Poller -> Airtable -> Postgres (inbound: users, reference data, translations)
User Webhook -> Airtable -> Postgres (inbound: fast-lane for user events)
```

## Completed Phases

### Phase 1-2: Foundation & Schema (DONE)
- `pg` v8.18.0 with direct parameterized queries (no ORM)
- Docker Compose with Postgres 16, Redis 7, worker service
- Migrations 001-013 covering all tables + indexes
- `api/_lib/db/client.ts` with pool management, `withDbTransaction()`, SSL

### Phase 3: Sync Engine (DONE)
- **Outbound:** Outbox pattern with idempotency keys, `enqueueSyncEvent()` in same transaction
- **Worker:** Poll-based `FOR UPDATE SKIP LOCKED`, exponential backoff, dead-letter after max retries
- **Airtable Writers:** Entity-specific upserts for all types with `RetryableSyncError` classification
- **Inbound - User Fast-Lane:** Webhook at `/api/sync/inbound.ts` with shared-secret auth, dedup via `sync_inbox_events`
- **Inbound - Full Sync:** Periodic poll (120s default) for users, reference data, translations
- **Dead-Letter Auto-Replay:** Worker replays dead-letter events when Airtable recovers (throttled by `DEAD_LETTER_REPLAY_SECONDS`)
- **Safe Outbox:** `enqueueSyncEventSafe()` fire-and-forget wrapper

### Phase 4: Repository Layer (DONE - 9 repos)
- `program-repo.ts`, `user-repo.ts`, `habit-usage-repo.ts`, `method-usage-repo.ts`
- `personal-goal-usage-repo.ts`, `overtuiging-usage-repo.ts`, `reference-repo.ts`
- `magic-link-repo.ts`, `streak-utils.ts`
- Shared helper: `program-generation-data.ts` (`loadProgramGenerationData()`)

### Phase 5: API Migration (DONE - all endpoints)

All endpoints use Postgres directly:

- `api/programs/index.ts` (GET, POST)
- `api/programs/[id].ts` (GET, PATCH, DELETE) - resolves linked names from reference tables
- `api/programs/[id]/schedule/[planningId].ts`
- `api/programs/[id]/methods` (GET)
- `api/programs/generate.ts`, `preview.ts`, `confirm.ts` - via `loadProgramGenerationData()`
- `api/habit-usage/index.ts` (GET, POST, DELETE)
- `api/method-usage/index.ts` (POST, PATCH)
- `api/method-usage/by-program.ts` (GET)
- `api/personal-goal-usage/index.ts`
- `api/overtuiging-usage/index.ts` (GET, POST)
- `api/rewards/index.ts` (GET)
- `api/methods/index.ts` (GET)
- `api/overtuigingen/index.ts` (GET)
- `api/persoonlijke-overtuigingen/index.ts` (GET, POST, PATCH, DELETE)
- `api/goals/index.ts`, `api/days/index.ts`, `api/mindset-categories/index.ts`
- `api/companies/lookup.ts`
- `api/auth/login.ts`, `me.ts`, `refresh.ts`, `set-password.ts`
- `api/auth/magic-link.ts`, `verify-code.ts`
- `api/translations/[lang].ts`

### Phase 6: Cutover & Cleanup (DONE)
- All `DATA_BACKEND_*` env vars and toggle system removed.
- `data-backend.ts` (`DataBackendMode`, `getDataBackendMode`, `isPostgresPrimary`, `isPostgresShadowRead`) deleted.
- All `handleGetAirtable`/`handlePostAirtable` code paths removed from endpoints.
- `cachedSelect` and `cached-airtable.ts` deleted.
- `shouldUsePostgresRewards` removed; rewards engine always uses Postgres.

### Phase 7: Testing & Observability (GAPS)
- Existing tests cover field-mappings, JWT, security, program utilities
- No tests for repositories, sync engine, worker, outbox
- Health endpoint reports DB status, outbox stats, dead-letter count
- No metrics dashboards or alerting

## Remaining Work

1. Write integration tests for sync worker (claim, retry, dead-letter)
2. Write unit tests for repositories
3. Add observability dashboard (outbox depth, sync lag, dead-letter trends)
4. Implement checkpoint-based incremental sync (replace full polls)
5. Add structured logging with correlation IDs
6. Create operational runbooks
7. Set up CI/CD pipeline with migration validation

## Architecture Decisions

| Decision | Actual |
|-|-|
| ORM | None - raw `pg` queries |
| Queue | Poll-based from `sync_outbox` table (no BullMQ dependency) |
| Inbound sync | Webhook (users) + periodic poll (all) |
| ID strategy | UUID primary keys + `airtable_id_map` |
| User auth | Read-through fallback to Airtable when user missing in Postgres |

## Schema Overview

**Operational:** `users_pg`, `programs_pg`, `program_schedule_pg`, `method_usage_pg`, `habit_usage_pg`, `personal_goals_pg`, `personal_goal_usage_pg`, `persoonlijke_overtuigingen_pg`
**Reference:** `reference_methods_pg`, `reference_goals_pg`, `reference_days_pg`, `reference_companies_pg`, `reference_program_prompts_pg`, `reference_experience_levels_pg`
**Auth:** `magic_link_codes`
**Sync:** `airtable_id_map`, `sync_outbox`, `sync_dead_letter`, `sync_checkpoint`, `sync_inbox_events`
