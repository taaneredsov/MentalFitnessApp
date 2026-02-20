# Implementation Plan: User Provisioning Read-Through + Airtable Webhook

## Version
v1.1.0

## Design Summary
Make login correctness independent from periodic sync by introducing:
1. **Synchronous read-through provisioning** in auth flows.
2. **Dedicated signed webhook endpoint** for immediate user event ingestion.

Postgres remains runtime source-of-truth. Airtable remains upstream source for certain admin workflows.

## Phase 1: Schema + Repository Hardening [COMPLETE]

### Tasks
- [x] Canonical email uniqueness (`LOWER(email)` unique index) — migration `009_user_status_and_email_index.sql`
- [x] User status column (`active`/`disabled`/`deleted`) for soft-delete support
- [x] `status` field added to `PgUser` interface and `mapUserRow()` in `user-repo.ts`
- [x] Auth guard: `loginViaPostgres()` rejects non-active users with 403

### Notes
- `airtable_record_id` column was not needed — `users_pg.id` IS the Airtable record ID.
- `upsertUserFromAirtable()` already handles re-keying when email exists under different ID.

## Phase 2: Auth Read-Through Provisioning [COMPLETE — pre-existing]

### Implementation
- `api/_lib/sync/user-readthrough.ts` — `getUserByEmailWithReadThrough()`, `getUserByIdWithReadThrough()`
- `api/_lib/sync/user-fast-lane.ts` — Airtable fetch + `upsertUserFromAirtable()`
- Already wired into `login.ts`, `refresh.ts`, `me.ts`
- Feature flag: `USER_READTHROUGH_FALLBACK_ENABLED` (default `true`)

## Phase 3: Webhook Endpoint [COMPLETE]

### Endpoint
- [x] `POST /api/sync/users/inbound` — `api/sync/users/inbound.ts`

### Payload Contract
- [x] Zod-validated: `eventId`, `eventType`, `occurredAt`, `user` object

### Validation + Security
- [x] HMAC SHA-256 via `X-Signature` header — `api/_lib/sync/webhook-auth.ts`
- [x] Timing-safe comparison via `crypto.timingSafeEqual`
- [x] Feature flag: `USER_WEBHOOK_SYNC_ENABLED` (default `false`)

### Processing
- [x] Idempotency via `ensureInboundEventNotDuplicate()` from user-fast-lane
- [x] `user.created`/`user.updated`: `syncUserRecords()` upsert
- [x] `user.deleted`: sets `status = 'deleted'` (login blocked by Phase 1 guard)

## Phase 4: Wiring + Config [COMPLETE]

### Tasks
- [x] Route registered in `server.ts`
- [x] Env vars: `AIRTABLE_USER_SYNC_SECRET`, `USER_WEBHOOK_SYNC_ENABLED`
- [x] Docker secret: `mfa_airtable_user_sync_secret`
- [x] `loadSecrets()` updated to read `AIRTABLE_USER_SYNC_SECRET` from file

## Rollout Plan
1. Deploy (migration runs automatically via post-receive hook)
2. Create Docker secret: `docker secret create mfa_airtable_user_sync_secret <secret-value>`
3. Note: adding new Docker secret requires `docker stack rm` + redeploy
4. Configure Airtable automation to POST to `/api/sync/users/inbound` with HMAC signature
5. Read-through continues as fallback for webhook failures

## Risks and Mitigations
- Risk: Field precedence conflicts.
  - Mitigation: explicit field ownership matrix, conservative updates.
- Risk: Airtable outage affects first-time logins.
  - Mitigation: fail-open for existing Postgres users; clear transient error for new users.
- Risk: Duplicate user rows.
  - Mitigation: canonical email unique constraint + conflict-safe upsert.
