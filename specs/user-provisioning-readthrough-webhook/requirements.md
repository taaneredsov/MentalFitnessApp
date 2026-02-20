# Requirements: User Provisioning Read-Through + Airtable Webhook Inbound

## Overview
Ensure users created in Airtable can log into the app immediately, even before background sync completes, while preserving Postgres-first runtime behavior.

This feature adds:
1. **Auth read-through provisioning** (on-demand user import during login/refresh paths).
2. **Dedicated webhook endpoint** for Airtable-driven user upsert/delete events.

## Problem Statement
- Current architecture is Postgres-first for app responsiveness.
- Some users are still created in Airtable first.
- If user records are not yet synced to Postgres, login can fail or be delayed.
- Background polling alone is insufficient for first-login correctness.

## User Stories
### As an end user, I want to:
1. Log in successfully even if my account was just created in Airtable.
2. Not wait for periodic sync before accessing the app.

### As an admin/integration owner, I want to:
1. Push user changes from Airtable to the app immediately via webhook.
2. Avoid duplicate users and race-condition failures.

## Functional Requirements

### A. Auth Read-Through Provisioning
- On auth flows that resolve user by email or id (`login`, `refresh`, `me` where relevant):
  - Attempt Postgres read first.
  - If not found, perform Airtable lookup.
  - If Airtable record exists, upsert user into Postgres synchronously and continue auth flow in same request.
- Read-through must be idempotent and safe under concurrent requests.
- Read-through must not overwrite newer Postgres values with stale Airtable values without explicit precedence rules.

### B. Dedicated User Webhook Endpoint
- Add endpoint: `POST /api/sync/users/inbound`
- Endpoint accepts user lifecycle events from Airtable integration:
  - `user.created`
  - `user.updated`
  - `user.deleted` (soft-delete handling as configured)
- Endpoint validates shared secret signature/token.
- Endpoint supports idempotency key/event id to prevent duplicate processing.
- Endpoint writes to Postgres directly or enqueues high-priority sync job with immediate processing semantics.

### C. Data Integrity and Identity
- User identity matching rules:
  1. `airtable_record_id` (if known)
  2. canonicalized email (case-insensitive)
- Postgres user table must enforce uniqueness for canonical email.
- Upsert strategy must be conflict-safe (`ON CONFLICT ... DO UPDATE`).

### D. Observability
- Log structured events for:
  - read-through hit/miss/provisioned
  - webhook accepted/rejected/replayed
  - upsert conflict path taken
- Add counters/metrics:
  - `auth_readthrough_attempts`
  - `auth_readthrough_success`
  - `webhook_user_events_processed`
  - `webhook_user_events_replayed`
  - `webhook_user_events_failed`

## Non-Functional Requirements
- Auth path read-through should not add more than ~300ms p95 for miss cases under normal Airtable/API conditions.
- Endpoint and auth flows must degrade gracefully when Airtable is unavailable:
  - Existing Postgres users must still log in.
  - Airtable-first users receive clear transient error.
- Security:
  - Reject unsigned/invalid webhook payloads.
  - Avoid leaking existence details in auth error responses.

## Acceptance Criteria
- [ ] Airtable-first user can log in immediately without waiting for background sync.
- [ ] Concurrent first-login attempts do not create duplicate Postgres user rows.
- [ ] Webhook endpoint accepts valid signed events and upserts user to Postgres.
- [ ] Replayed webhook event is idempotent (no duplicate side effects).
- [ ] Existing Postgres-only auth behavior remains unchanged.
- [ ] Integration tests cover read-through provision and webhook idempotency.

## Out of Scope
- Full bi-directional user profile conflict resolution UI.
- Migration of all entities to webhook-driven sync.
- Replacing existing generic sync inbound endpoint.
