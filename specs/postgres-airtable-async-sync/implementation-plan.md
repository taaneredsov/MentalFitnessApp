# Implementation Plan: Postgres Intermediate DB + Async Airtable Sync

## Overview

This plan migrates hot operational paths from Airtable to Postgres, while preserving Airtable as a synchronized system. The rollout is incremental and controlled by feature flags to limit risk.

## Target Architecture

```text
PWA -> API -> Postgres (primary reads/writes)
             -> Outbox events (same transaction)

Sync Worker -> reads outbox -> Airtable API (async)

Airtable Webhook/Poller -> Inbound Sync Handler -> Postgres upsert
```

## Phase 0: Design Lock and Scope

### Tasks

- [ ] Confirm authority matrix per table.
- [ ] Confirm ORM/tooling choice (Prisma or Drizzle).
- [ ] Confirm queue implementation (BullMQ on existing Redis, or DB-only worker polling).
- [ ] Define endpoint migration order and release sequence.
- [ ] Confirm user fast-lane SLO and alert thresholds.

### Recommended Decision Set

- Postgres + Prisma for schema/migrations.
- BullMQ for outbox delivery orchestration on existing Redis.
- Endpoint migration order:
  - `/api/programs`
  - `/api/habit-usage`
  - `/api/method-usage`
  - `/api/personal-goal-usage`

## Phase 1: Foundation and Infrastructure

### Tasks

- [ ] Add Postgres and ORM dependencies.
- [ ] Add migration scripts to `package.json`.
- [ ] Add runtime env vars in `.env.example`.
- [ ] Add worker start command and deployment wiring.
- [ ] Add fast-lane queue/env settings for user inbound sync.

### Code Changes

- `package.json`
  - Add ORM, Postgres driver, queue packages.
  - Add scripts like `db:migrate`, `db:generate`, `worker:start`.
- `.env.example`
  - Add `DATABASE_URL`.
  - Add `SYNC_QUEUE_NAME`.
  - Add `SYNC_BATCH_SIZE`.
  - Add `SYNC_MAX_RETRIES`.
  - Add `SYNC_USER_FAST_LANE_QUEUE_NAME`.
  - Add `SYNC_USER_FALLBACK_POLL_SECONDS`.
- `docker-compose.yml`
  - Add optional `postgres` service for local dev.
  - Add `worker` service for sync job processing.

### Notes

- Reuse existing Redis for queue.
- Keep production secrets file-based, aligned with existing secret loading flow.

## Phase 2: Postgres Schema and Mapping

### Tasks

- [ ] Create baseline schema and migrations.
- [ ] Create ID mapping strategy for Airtable record IDs.
- [ ] Add outbox and dead-letter tables.
- [ ] Add indexes for user/date/program hot queries.

### Proposed Core Tables

- `users`
- `programs`
- `program_schedule`
- `method_usage`
- `habit_usage`
- `personal_goal_usage`
- `personal_goals`
- `reference_methods`
- `reference_goals`
- `reference_days`

### Sync Control Tables

- `airtable_id_map`
  - `entity_type`, `postgres_id`, `airtable_record_id`, `last_synced_at`
- `sync_outbox`
  - `id`, `event_type`, `entity_type`, `entity_id`, `payload`, `status`, `attempt_count`, `next_attempt_at`, `created_at`
- `sync_checkpoint`
  - per-table cursor/checkpoint for inbound sync
- `sync_dead_letter`
  - failed event snapshot with failure metadata

### Constraints and Indexes

- Unique index on `(entity_type, postgres_id)` and `(entity_type, airtable_record_id)` in mapping table.
- Unique idempotency key per logical write event in outbox.
- Compound indexes:
  - programs by `(user_id, start_date desc)`
  - habit_usage by `(user_id, usage_date)`
  - method_usage by `(program_id, used_at desc)`

## Phase 3: Sync Engine (Outbound + Inbound)

### Tasks

- [ ] Implement outbox enqueue helper inside DB transaction boundary.
- [ ] Implement sync worker with retry and backoff.
- [ ] Implement Airtable upsert adapters per entity.
- [ ] Implement inbound sync endpoint (webhook) or poller.
- [ ] Implement dead-letter and replay tooling.
- [ ] Implement dedicated high-priority inbound path for `users` events.
- [ ] Implement user read-through fallback in auth/user lookup flows.

### Outbound Flow

1. API transaction writes business row.
2. Same transaction writes `sync_outbox` row.
3. Worker claims due outbox jobs.
4. Worker maps payload to Airtable fields and writes record.
5. Worker updates mapping table and marks outbox event as processed.

### Inbound Flow

1. Receive Airtable change event or poll by checkpoint.
2. Validate signature/secret.
3. Normalize Airtable record to internal schema.
4. Upsert into Postgres by `airtable_record_id` mapping.
5. Advance checkpoint atomically.

### User Fast-Lane Inbound Flow

1. Airtable `users` create/update event enters dedicated high-priority queue.
2. Worker processes user event immediately (no large batch wait).
3. User row upserted in Postgres and mapping table updated.
4. If webhook fails, periodic fallback poll (`SYNC_USER_FALLBACK_POLL_SECONDS`) catches missed records.

### User Read-Through Fallback

If login/user lookup does not find the user in Postgres:

1. Perform direct Airtable lookup for that specific user/email.
2. If found, upsert into Postgres synchronously.
3. Continue request using Postgres user model.
4. Emit metric for fallback-hit rate (should trend to low values after steady state).

### Conflict Policy

- Postgres-authoritative entities:
  - Outbound wins by default.
  - Inbound updates ignored except metadata fields.
- Airtable-authoritative entities:
  - Inbound updates overwrite Postgres projection.
- Mixed entities:
  - Field-level policy per column with explicit source-of-truth markers.

### Idempotency

- Outbox events use deterministic idempotency keys.
- Worker writes include request fingerprinting to avoid duplicate Airtable writes after retries.
- Inbound handler upserts by stable mapping keys and ignores stale timestamps.

## Phase 4: Repository Integration

### Tasks

- [ ] Create DB layer in `api/_lib/db/`.
- [ ] Create repository modules in `api/_lib/repos/`.
- [ ] Create sync modules in `api/_lib/sync/`.
- [ ] Add worker entrypoint in `tasks/` or `api/workers/`.

### Suggested File Additions

- `api/_lib/db/client.ts`
- `api/_lib/db/schema.ts`
- `api/_lib/repos/program-repo.ts`
- `api/_lib/repos/habit-usage-repo.ts`
- `api/_lib/repos/method-usage-repo.ts`
- `api/_lib/sync/outbox.ts`
- `api/_lib/sync/airtable-writers.ts`
- `api/_lib/sync/inbound-handler.ts`
- `tasks/sync-worker.ts`

### Endpoint Refactor Plan

1. `api/programs/index.ts`
   - Replace full Airtable reads with repository queries.
   - Persist writes to Postgres and enqueue outbox events.
2. `api/habit-usage/index.ts`
   - Replace date-range Airtable scans with indexed Postgres queries.
   - Keep user streak updates transactional in Postgres.
3. `api/method-usage/index.ts`
   - Move create and patch operations to Postgres.
4. `api/personal-goal-usage/index.ts`
   - Move usage writes and reads to Postgres.
5. `api/auth/login.ts`, `api/auth/me.ts`, and user lookup paths
   - Use Postgres as primary source.
   - Add user read-through fallback to Airtable when missing.

## Phase 5: Data Migration and Backfill

### Tasks

- [ ] Build one-time import scripts from Airtable to Postgres.
- [ ] Import reference tables first.
- [ ] Import operational tables in dependency order.
- [ ] Validate row counts and key samples.

### Backfill Order

1. users
2. reference tables (methods, goals, days)
3. programs
4. program_schedule
5. usage tables

### Validation Rules

- Record counts match within expected tolerance.
- Random sample verification by user/program/date.
- Derived progress parity checks between old and new path.

## Phase 6: Cutover Strategy

### Tasks

- [x] Add per-endpoint data backend flags.
- [ ] Enable shadow reads for parity checks.
- [x] Enable Postgres primary for one endpoint at a time. *(All endpoints switched to `postgres_primary` on 2026-02-20, except `DATA_BACKEND_OVERTUIGINGEN` which remains `airtable_only`)*
- [ ] Monitor and rollback quickly if divergence appears.
- [x] Enable user fast-lane before migrating auth/user endpoints.

### Feature Flags

Per-endpoint backend flags (values: `airtable_only` | `postgres_shadow_read` | `postgres_primary`):

| Flag | Production Value (as of 2026-02-20) |
|------|-------------------------------------|
| `DATA_BACKEND_PROGRAMS` | `postgres_primary` |
| `DATA_BACKEND_HABIT_USAGE` | `postgres_primary` |
| `DATA_BACKEND_METHOD_USAGE` | `postgres_primary` |
| `DATA_BACKEND_PERSONAL_GOAL_USAGE` | `postgres_primary` |
| `DATA_BACKEND_OVERTUIGING_USAGE` | `postgres_primary` |
| `DATA_BACKEND_REWARDS` | `postgres_primary` |
| `DATA_BACKEND_METHODS` | `postgres_primary` |
| `DATA_BACKEND_PERSONAL_GOALS` | `postgres_primary` |
| `DATA_BACKEND_OVERTUIGINGEN` | `airtable_only` *(read-only cached, no Postgres handler)* |

Boolean flags:
- `USER_FAST_LANE_ENABLED`
- `USER_READTHROUGH_FALLBACK_ENABLED`
- `FULL_AIRTABLE_POLL_SYNC_ENABLED`

### Rollback

- Switch endpoint flag back to `airtable_only`.
- Keep outbox processing paused or running based on incident context.
- Reconcile drift from outbox/dead-letter before reattempting cutover.

## Phase 7: Testing and Observability

### Tasks

- [ ] Add unit tests for repositories and mappers.
- [ ] Add integration tests for endpoint behavior parity.
- [ ] Add worker tests for retry/idempotency/dead-letter.
- [ ] Add dashboards and alerts.

### Observability Requirements

- API latency p50/p95 by endpoint and backend mode.
- Outbox queue depth.
- Outbox processing rate.
- Sync lag (oldest unprocessed event age).
- Dead-letter count and rate.
- Airtable API error rate by status code.
- User fast-lane lag (Airtable timestamp to Postgres availability).
- User provisioning SLO compliance (<=15s p95, <=60s p99).
- User read-through fallback hit rate.

## Phase 8: Post-Cutover Cleanup

### Tasks

- [ ] Remove unused Airtable read paths from migrated endpoints.
- [ ] Keep Airtable adapters only for sync layer and authoritative reference data.
- [ ] Update documentation in `docs/architecture/overview.md`.
- [ ] Revisit Redis cache TTL strategy after Postgres migration.

## Risks and Mitigations

- Risk: Data divergence between systems.
  - Mitigation: outbox + idempotency + reconciliation jobs + shadow reads.
- Risk: Airtable rate limiting during catch-up.
  - Mitigation: worker throttling, batch sizing, backoff.
- Risk: Higher operational complexity.
  - Mitigation: runbooks, alerts, controlled rollout flags.
- Risk: Incorrect authority boundaries.
  - Mitigation: explicit table/field ownership document and code guards.
- Risk: Newly created Airtable users not immediately available in app.
  - Mitigation: dedicated user fast-lane + auth read-through fallback + periodic safety poll.

## Definition of Done

- Migrated endpoints serve production traffic from Postgres in `postgres_primary`.
- P95 latency for migrated endpoints is materially improved.
- Sync success rate is stable with monitored, low dead-letter volume.
- Runbooks and rollback procedures are documented and tested.
