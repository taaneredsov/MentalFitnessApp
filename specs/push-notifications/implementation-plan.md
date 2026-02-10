# Implementation Plan: Push Notifications for Scheduled Activities

## Overview

Implement push notifications on top of the Postgres-primary architecture, with asynchronous scheduling and delivery handled by the worker process.

## Target Architecture

```text
PWA (permission + subscription)
  -> API /notifications/*
      -> Postgres (subscriptions, preferences, jobs)

Program/schedule changes
  -> job planner (create/update/cancel notification jobs)

Worker loop
  -> claim due notification jobs
  -> send Web Push
  -> record delivery + retries + cleanup expired subscriptions
```

## Phase 0: Product and Policy Lock

### Tasks

- [x] Reminder policy model fixed: user-managed only.
- [x] Initial channel implemented: push only.
- [x] Reminder modes fixed: `session`, `daily_summary`, `both`.
- [x] Deep-link destination fixed: Today Activity view.
- [x] Timing model fixed: date-only schedule + user preferred reminder time.
- [x] Quiet-hours semantics fixed: skip reminders inside quiet hours.
- [x] Notification localization fixed: use `users_pg.language_code` (from Airtable `Taalcode`).
- [x] Planned programs included in reminder scope.
- [x] In-app fallback required when push permission is denied.

### Output

- Final reminder policy table and defaults signed off.

## Phase 1: Database and Env Foundation

### Tasks

- [x] Add migration `tasks/db/migrations/004_push_notifications.sql`.
- [x] Create `push_subscriptions_pg`.
- [x] Create `notification_preferences_pg`.
- [x] Create `notification_jobs_pg`.
- [x] Create `notification_delivery_log_pg`.
- [x] Add indexes for due-job scans and user lookups.

### Proposed Schema Notes

- `push_subscriptions_pg`
  - unique `endpoint`
  - `status` (`active`, `revoked`, `expired`)
- `notification_preferences_pg`
  - PK `user_id`
  - `enabled`, `reminder_mode`, `lead_minutes`, `preferred_time_local`, `timezone`, `quiet_hours_*`
- `notification_jobs_pg`
  - unique `dedupe_key`
  - `status` (`pending`, `processing`, `sent`, `dead_letter`, `cancelled`, `skipped_quiet_hours`)
  - `fire_at`, `attempt_count`, `next_attempt_at`, `mode` (`session` or `daily_summary`)
- `notification_delivery_log_pg`
  - references job + subscription
  - http status / error payload

### Env Variables

- [x] Add to `.env.example`:
  - `WEB_PUSH_VAPID_PUBLIC_KEY`
  - `WEB_PUSH_VAPID_PRIVATE_KEY`
  - `WEB_PUSH_SUBJECT`
  - `NOTIFICATION_BATCH_SIZE`
  - `NOTIFICATION_MAX_RETRIES`
  - `NOTIFICATION_RETRY_BASE_SECONDS`
  - `NOTIFICATION_RECONCILE_SECONDS`

## Phase 2: Backend Repositories and APIs

### Tasks

- [x] Add repo modules:
  - `api/_lib/repos/notification-subscription-repo.ts`
  - `api/_lib/repos/notification-preference-repo.ts`
  - `api/_lib/repos/notification-job-repo.ts`
- [x] Add endpoints:
  - `api/notifications/subscribe.ts`
  - `api/notifications/preferences.ts`
  - `api/notifications/test.ts`
- [x] Register routes in `server.ts`.
- [x] Add auth + input validation (zod).

### API Contracts

- `POST /api/notifications/subscribe`
  - Body: standard PushSubscription JSON (`endpoint`, `keys.p256dh`, `keys.auth`).
  - Result: upsert active device subscription.
- `DELETE /api/notifications/subscribe`
  - Body: `endpoint`.
  - Result: mark subscription revoked.
- `GET /api/notifications/preferences`
  - Returns user preference row or defaults.
- `PATCH /api/notifications/preferences`
  - Updates settings and triggers future-job rescheduling.
  - Supports `reminderMode` = `session` | `daily_summary` | `both`.

## Phase 3: PWA Service Worker + Client UX

### Tasks

- [x] Move `vite-plugin-pwa` config to custom SW strategy (inject manifest).
- [x] Add custom service worker (`src/sw.js`) with:
  - `push` event handler
  - `notificationclick` event handler
- [x] Add client utility for subscribe/unsubscribe (`src/lib/push.ts`).
- [x] Add settings UI (Account page preferred):
  - permission status
  - enable toggle
  - reminder mode selector (`session`, `daily_summary`, `both`)
  - lead-time selector
  - preferred reminder time
  - quiet-hours controls
- [x] Add denied-permission fallback UI:
  - in-app reminder banner/card on Home and Program detail.
- [x] Localize notification title/body from user `language_code`.

### UX Requirements

- Unsupported browser/device path is explicit and non-blocking.
- Permission denied state is handled without repeated prompts.
- In-app fallback reminder is shown when permission is denied.
- Notification click opens Today Activity view.
- “Test notification” action available in dev or protected admin mode.

## Phase 4: Notification Planning Engine

### Tasks

- [x] Add planner module `api/_lib/notifications/planner.ts`.
- [x] Generate jobs for future sessions from `program_schedule_pg` for running and planned programs.
- [x] Generate daily summary jobs (one per user per day when due sessions exist).
- [x] Apply quiet-hours skip logic during planning and pre-send validation.
- [x] Cancel pending jobs when:
  - session completed
  - program finished/cancelled
  - notifications disabled
- [x] Add dedupe key strategy:
  - `session:<program_schedule_id>:user:<user_id>:lead:<lead_minutes>`
  - `daily:<user_id>:date:<yyyy-mm-dd>:lead:<lead_minutes>`

### Integration Points

- After backfill/full sync updates schedule data.
- After schedule mutation endpoints (edit/regenerate).
- After method usage updates completion state.
- After preference changes (recompute future jobs).

## Phase 5: Worker Delivery Loop

### Tasks

- [x] Add worker processor (implemented in `api/_lib/notifications/worker.ts` and integrated in `sync-worker.ts` loop).
- [x] Claim due jobs using `FOR UPDATE SKIP LOCKED`.
- [x] Send via Web Push library (VAPID).
- [x] Record attempt in `notification_delivery_log_pg`.
- [x] Update job status (`sent`, retry pending, dead_letter).
- [x] Mark jobs as `skipped_quiet_hours` when applicable.
- [x] Revoke subscriptions on 404/410 responses.

### Retry Policy

- Quadratic backoff (same pattern as sync outbox).
- Max retry count configurable.
- Transient network/5xx -> retry.
- Permanent payload/authorization errors -> dead letter.

## Phase 6: Observability and Operations

### Tasks

- [x] Extend `/api/health` with notification stats:
  - pending jobs
  - oldest pending age
  - dead letter count
- [x] Add structured logs for scheduling + sending.
- [ ] Add external counters/monitoring integration:
  - scheduled job count
  - sent count
  - failure count
  - revoked subscription count

## Phase 7: Rollout and Validation

### Tasks

- [x] Feature flags:
  - `PUSH_NOTIFICATIONS_ENABLED`
  - `PUSH_NOTIFICATIONS_TEST_MODE`
- [ ] Internal pilot with a small user cohort.
- [ ] Verify iOS PWA installed flow and Android/desktop browser flow.
- [ ] Compare planned-vs-sent counts over 7 days.

### Validation Checklist

1. Create/update user preferences and verify persisted values.
2. Subscribe from two devices for one user and validate fan-out.
3. Create a scheduled session and verify job creation.
4. Validate all reminder modes: `session`, `daily_summary`, `both`.
5. Complete the session before `fire_at` and verify job cancellation.
6. Simulate expired subscription (410) and verify auto-revocation.
7. Verify deep-link open behavior from notification click.
8. Deny push permission and verify in-app fallback reminder appears.
9. Verify reminders in quiet hours are skipped (not deferred).
10. Verify localized notification copy for users with different `language_code` values.

## Phase 8: Out of Scope Guardrails

- Airtable-managed reminder policy/defaults are explicitly out of scope for this feature.
- If reintroduced later, implement via Postgres projection and async sync, not request-time Airtable reads.

## Risks and Mitigations

- **No session time in current schedule model**:
  - Mitigation: use user preferred reminder time + lead minutes.
- **Browser support fragmentation**:
  - Mitigation: capability detection and clear fallback UX.
- **Duplicate notifications after resync/reschedule**:
  - Mitigation: strict dedupe keys and idempotent upsert.
- **Worker downtime creates lag**:
  - Mitigation: queue lag metrics + operational alerts.
