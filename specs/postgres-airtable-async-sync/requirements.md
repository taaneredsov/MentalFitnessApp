# Requirements: Postgres Primary DB + Async Airtable Sync

## Overview

PostgreSQL is the primary operational database for the app. Airtable remains as a synchronized system for content/admin workflows. All API reads and writes use Postgres. Airtable synchronization runs asynchronously in the background via a 3-lane architecture.

## Architecture (Current State)

### 3-Lane Sync Architecture

1. **Inbound (Airtable -> Postgres):** Users, reference data (methods, goals, days, mindset categories, companies, prompts, experience levels), and translations sync from Airtable into Postgres via periodic full-sync polling.
2. **User Fast-Lane (Airtable -> Postgres):** Dedicated webhook for user create/update events with read-through fallback for auth flows.
3. **Outbound (Postgres -> Airtable):** User-generated data (programs, schedule, usage records, personal goals, overtuigingen) syncs from Postgres to Airtable via outbox pattern.

All API endpoints read from and write to Postgres exclusively. There are no Airtable-first code paths or feature flag toggles.

## Data Authority Model

**Postgres authoritative** (all user-generated/session-critical data):
- programs, program_schedule
- method_usage, habit_usage, personal_goal_usage
- persoonlijke_overtuigingen
- personal_goals
- derived progress summaries
- magic_link_codes
- rewards (bonus_points, badges, level on users_pg)

**Airtable authoritative** (content/admin managed, synced inbound):
- methods, goals, days_of_week, mindset_categories
- companies, program_prompts, experience_levels
- translations
- users (provisioned in Airtable, synced inbound)

## Acceptance Criteria

### Database Foundation
- [x] PostgreSQL provisioned and reachable from runtime.
- [x] Migration tooling added and baseline schema versioned (001-013).
- [x] Core operational tables with indexes for user/time-based access patterns.
- [x] Bidirectional ID mapping via `airtable_id_map` table.

### Outbox + Worker
- [x] All write endpoints persist business change and outbox event in one DB transaction.
- [x] Worker processes outbox with idempotent Airtable writes and exponential backoff.
- [x] Dead-letter after max retries with auto-replay when Airtable recovers.
- [x] `enqueueSyncEventSafe()` fire-and-forget wrapper prevents outbox failures from breaking user-facing writes.

### Inbound Sync
- [x] Periodic full-sync polls Airtable for reference data, users, and translations.
- [x] Inbound handler supports idempotent upsert semantics.
- [x] User fast-lane webhook with shared-secret auth (`x-sync-secret` header).
- [x] Read-through fallback for user lookup/auth if user not yet in Postgres.

### API Migration
- [x] All endpoints run against Postgres (no Airtable-first code paths remain).
- [x] Auth endpoints (magic-link, verify-code, set-password) use Postgres.
- [x] AI program generation loads reference data from Postgres.

### Performance and Reliability
- [x] P95 latency materially improved on all endpoints vs Airtable baseline.
- [x] Endpoint behavior functionally equivalent.
- [ ] Queue backlog, sync lag, and sync failure metrics emitted.
- [x] User sync SLO: Airtable-created users available within <=15s (p95), <=60s (p99).

### Security and Operations
- [x] Postgres credentials managed as Docker secrets.
- [ ] Worker and API use least-privilege DB roles where feasible.
- [ ] Runbook exists for replaying failed sync events and temporary fallback.

## Success Metrics

- P95 for all endpoints reduced vs Airtable baseline.
- Airtable API request volume reduced to sync-only traffic.
- Sync success rate above 99% with monitored dead-letter count.
- Airtable-created users available for login in <=15s (p95), <=60s (p99).

## Dependencies

- PostgreSQL instance (in Docker Swarm stack).
- Redis instance (in stack) for general caching.
- Airtable API access token and base permissions.
- Worker service for sync job processing.
