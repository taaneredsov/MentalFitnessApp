# Requirements: Postgres Intermediate DB + Async Airtable Sync

## Overview

Introduce PostgreSQL as the primary operational database for the app, and keep Airtable as a synchronized system for content/admin workflows. The PWA and API should read/write fast paths from Postgres, while Airtable synchronization runs asynchronously in the background.

## Problem Statement

Current Airtable-first endpoints still require expensive full-table reads and in-memory filtering in multiple flows, especially for user-specific operational data.

Examples in current code:
- `api/programs/index.ts` fetches all programs and filters in code.
- `api/programs/index.ts` also fetches all schedule and method usage records to compute progress.
- `api/habit-usage/index.ts` frequently fetches records by date and filters user/method links in code.

Even with Redis caching in place, write paths and highly dynamic views still depend on Airtable latency.

## Goals

- Reduce API latency for high-frequency app interactions (programs, usage, progress, streaks).
- Remove Airtable from request-time dependency for hot operational paths.
- Preserve Airtable as a synchronized destination/source where needed.
- Add resilient async sync with retries, idempotency, and dead-letter handling.
- Enable incremental migration and safe rollback.

## Non-Goals

- Full Airtable decommission in this phase.
- Rebuilding all Airtable automations immediately.
- Rewriting every endpoint in one release.

## Proposed Solution

- Postgres becomes the primary store for operational entities.
- API writes use local Postgres transactions and append sync intents to an outbox table.
- Worker processes outbox events and writes to Airtable asynchronously.
- Inbound sync (webhook or polling) keeps Postgres aligned for Airtable-authoritative tables.
- Feature flags control rollout and fallback.

## User Fast Lane (Airtable-Managed User Provisioning)

Because user management is expected to happen in Airtable, user records require faster inbound sync than normal background flows.

- User create/update events from Airtable must be processed through a high-priority inbound lane.
- User synchronization should not wait for bulk/reference sync batches.
- Auth/user lookup flows must support read-through fallback to Airtable when a user is missing in Postgres, then immediately upsert to Postgres.
- A periodic safety poll must remain enabled to recover from webhook delivery failures.

## Data Authority Model

Postgres authoritative (write-heavy, user-session critical):
- programs
- program_schedule
- method_usage
- habit_usage
- personal_goal_usage
- derived progress summaries

Airtable authoritative (content/admin managed):
- methods
- goals
- days_of_week
- mindset_categories
- prompts/static configuration

Mixed or staged authority:
- users
- personal_goals
- overtuigingen and related links

## Acceptance Criteria

### Database Foundation
- [ ] PostgreSQL is provisioned and reachable from runtime.
- [ ] Migration tooling is added and baseline schema is versioned.
- [ ] Core operational tables exist with indexes for user/time-based access patterns.
- [ ] Each synced entity stores both `postgres_id` and `airtable_record_id` (or mapping table).

### Outbox + Worker
- [ ] All migrated write endpoints persist business change and outbox event in one DB transaction.
- [ ] Worker processes outbox reliably with idempotent Airtable writes.
- [ ] Retry with backoff exists for transient failures.
- [ ] Permanent failures are routed to dead-letter storage for manual replay.

### Inbound Sync
- [ ] Airtable changes for authoritative tables are applied into Postgres.
- [ ] Inbound handler supports idempotent upsert semantics.
- [ ] Sync checkpointing prevents duplicate reprocessing.
- [ ] User fast-lane inbound processing exists for `users` table events.
- [ ] Read-through fallback exists for user lookup/auth if user is not yet in Postgres.

### API Migration
- [ ] `/api/programs` GET and POST run against Postgres for reads and writes.
- [ ] `/api/habit-usage` GET/POST/DELETE run against Postgres.
- [ ] `/api/method-usage` write and read hot paths run against Postgres.
- [ ] Existing auth model remains unchanged.

### Performance and Reliability
- [ ] P95 latency drops materially on migrated endpoints versus current Airtable-backed baseline.
- [ ] Endpoint behavior remains functionally equivalent.
- [ ] Queue backlog, sync lag, and sync failure metrics are emitted.
- [ ] User sync SLO: Airtable-created users available in app within <=15s (p95), <=60s (p99).

### Security and Operations
- [ ] Postgres credentials are managed as secrets (not checked in).
- [ ] Worker and API use least-privilege DB roles where feasible.
- [ ] Runbook exists for replaying failed sync events and temporary fallback.

## Compatibility and Rollout Requirements

- Endpoint-level feature flags must allow:
  - `airtable_only`
  - `postgres_shadow_read`
  - `postgres_primary`
- Cutover can be done endpoint-by-endpoint.
- Rollback can be done without data loss (outbox retained, Airtable mapping retained).

## Success Metrics

- P95 for `/api/programs` and `/api/habit-usage` reduced by at least 50% after cutover.
- Airtable API request volume reduced significantly on migrated flows.
- Sync success rate above 99% with monitored dead-letter count.
- Airtable-created users are available for login in <=15s (p95), <=60s (p99).

## Dependencies

- Managed PostgreSQL instance.
- Existing Redis instance (already in stack) for queue/worker coordination.
- Airtable API access token and base permissions.
- Deployment support for running an additional worker process.
