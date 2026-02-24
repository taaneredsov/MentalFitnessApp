# Airtable Independence Gap Audit

Date: 2026-02-24
Scope: Verify that app runtime is fully functional without Airtable (Postgres-primary), with async bidirectional sync between Postgres and Airtable.

## Target Architecture

1. App runtime reads/writes primary data in Postgres.
2. Airtable is management interface and async replica.
3. Postgres -> Airtable sync via outbox worker.
4. Airtable -> Postgres sync via inbound webhook and/or poll worker.
5. Airtable outage must not break user-critical app flows.

## Confirmed Gaps

### Critical

1. Magic-link token verification is Airtable-only (`GET /api/auth/verify`).
- Impact: login can fail when Airtable is unavailable.

2. User profile/password update endpoints still depend on Airtable writes.
- `POST /api/users/change-password`: Airtable-only write path.
- `PATCH /api/users/:id`: Airtable-first write, Postgres mirror second.
- Impact: user/account operations fail when Airtable is unavailable.

3. `PATCH/DELETE /api/persoonlijke-overtuigingen/:id` is Airtable-only.
- Impact: feature breaks during Airtable outage.

4. Reverse sync has no deletion reconciliation.
- Full poll sync upserts records but does not remove records deleted in Airtable.
- Impact: Postgres can drift and retain stale data indefinitely.

### High

5. Program extension (Postgres-primary path) still fetches days/method metadata from Airtable.
- Impact: extending a program can fail without Airtable.

6. Postgres-primary schedule patch still calls Airtable to build session descriptions.
- Impact: editing future sessions can fail without Airtable.

7. Outbox user sync writer ignores `passwordHash` and other fields if present in payload.
- Impact: some user changes enqueued for Airtable sync are silently not propagated.

### Medium

8. Method detail endpoint intentionally keeps media Airtable-only.
- Impact: method detail/media experience is not Airtable-independent.

9. Inbound webhook fast-lane supports only users.
- Other Airtable-originated changes rely on periodic full polling only (higher staleness window).

10. Data-backend defaults to `airtable_only` when env is missing.
- Impact: misconfiguration can silently disable Postgres-primary behavior.

## Remediation Plan (Priority Order)

## Phase 1: Unblock Core User Auth/Account Without Airtable

1. Add Postgres-primary path to `GET /api/auth/verify`.
- Verify token/code against Postgres `magic_link_codes_pg`.
- Clear/consume token in Postgres.
- Enqueue outbox user sync for last-login and any mirrored fields.

2. Refactor `POST /api/users/change-password` to Postgres-primary.
- Update `users_pg.password_hash`.
- Enqueue user outbox sync event (non-blocking).

3. Refactor `PATCH /api/users/:id` to Postgres-primary.
- Write primary update to Postgres.
- Enqueue outbox sync to Airtable.
- Keep Airtable path only for explicit `airtable_only` mode.

Acceptance criteria:
- With Airtable unavailable and Postgres available, login/profile/password flows still succeed.

## Phase 2: Remove Remaining Airtable Hard Dependencies in Postgres-Primary Paths

1. Add Postgres-primary handlers for `PATCH/DELETE /api/persoonlijke-overtuigingen/:id`.
- Use repository methods + outbox events.

2. Refactor program extension metadata reads (`days`, `methods`) to Postgres reference repos.

3. Refactor schedule patch `buildSessionDescription()` to use Postgres reference methods in Postgres-primary mode.

Acceptance criteria:
- All program edit/extend + persoonlijke overtuigingen flows work with Airtable offline.

## Phase 3: Close Sync Correctness Gaps

1. Implement deletion reconciliation in full Airtable->Postgres sync.
- For each synced table, mark-seen then soft-delete/remove missing rows.
- Preserve id-map consistency.

2. Expand user outbox writer mapping.
- Support payload fields used by emitters (including `passwordHash` where intended).
- Add test coverage for each mapped field.

3. Add inbound webhook handlers for additional frequently edited Airtable tables (optional but recommended).
- At minimum: programs, schedules, personal goals.

Acceptance criteria:
- Airtable deletes are reflected in Postgres within defined SLA.
- Outbox payload fields are not dropped silently.

## Phase 4: Configuration and Guardrails

1. Fail startup in production if required `DATA_BACKEND_*` modes are missing/misconfigured.

2. Add health check dimensions:
- `postgres_primary_ready`
- `outbox_lag_seconds`
- `last_full_poll_sync_at`
- `airtable_connectivity` (degraded, non-fatal)

3. Add integration tests for Airtable-down scenarios on critical routes.

Acceptance criteria:
- Misconfiguration is detected early.
- Airtable outage is observable and non-fatal to core app runtime.

## Suggested Implementation Sequence (Short)

1. `api/auth/verify.ts` Postgres-primary
2. `api/users/change-password.ts` Postgres-primary
3. `api/users/[id].ts` Postgres-primary
4. `api/persoonlijke-overtuigingen/[id].ts` Postgres-primary
5. `api/programs/[id]/extend.ts` remove Airtable reads in PG path
6. `api/programs/[id]/schedule/[planningId].ts` remove Airtable reads in PG path
7. `api/_lib/sync/full-sync.ts` deletion reconciliation
8. `api/_lib/sync/airtable-writers.ts` user payload coverage fix

## Definition of Done

1. Core user workflows succeed with Airtable offline.
2. Outbox drains and syncs to Airtable when Airtable recovers.
3. Airtable edits/deletes are reflected back into Postgres (within configured sync interval).
4. No route in Postgres-primary mode performs mandatory Airtable reads for critical runtime paths.
