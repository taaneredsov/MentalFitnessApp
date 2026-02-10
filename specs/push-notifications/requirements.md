# Requirements: Push Notifications for Scheduled Activities

## Overview

Add web push notifications to alert users when they have a scheduled activity in their running or planned program. Notifications must be configurable, reliable, and aligned with the Postgres-primary + async-worker architecture.

## Problem Statement

Users can miss planned activities because reminders are only visible in-app. The app already stores schedule and usage in Postgres, but there is no proactive reminder channel.

## Goals

- Notify users before a scheduled activity.
- Support both reminder styles: session reminders and daily summary reminders.
- Allow reminder behavior to be managed (enable/disable, reminder timing, quiet hours).
- Keep delivery fully async and non-blocking for API requests.
- Integrate with existing worker/runtime instead of creating request-time Airtable dependencies.
- Support idempotent scheduling and delivery retries.

## Non-Goals

- SMS, WhatsApp, or email notification channels in this phase.
- Marketing/broadcast campaigns.
- Real-time bi-directional device sync beyond push subscription lifecycle.

## User Stories

- As a user, I can opt in to push notifications and revoke them later.
- As a user, I can configure reminder timing and quiet hours.
- As a user, I can choose reminder mode: per-session, daily summary, or both.
- As a user, I receive a reminder when an activity is due and can tap to open the relevant program/session.
- As an operator/admin, I can monitor notification backlog, failures, and delivery latency.

## Proposed Behavior

### Trigger Source

- Notification triggers are derived from `program_schedule_pg` for running and planned programs.
- Reminder is only sent if the session is still incomplete at send time.

### Default Reminder Logic

- Schedule-level reminders are calculated from:
  - `session_date` (from `program_schedule_pg`)
  - User preference: `preferred_time_local` and `reminder_lead_minutes`
- Timing model for this feature is fixed to date-only schedule + user preferred reminder time (no explicit per-session clock time).
- Example: preferred time `19:00`, lead `60` => send at `18:00` local time on `session_date`.

### Reminder Modes

- `session`: one reminder per scheduled session.
- `daily_summary`: one reminder per day when at least one scheduled session is due.
- `both`: schedule both session reminders and daily summary reminders.
- Mode is user-configurable in app settings.

### Manageability

- User-manageable settings:
  - enabled/disabled
  - reminder mode (`session`, `daily_summary`, `both`)
  - lead time (minutes)
  - preferred daily reminder time
  - quiet hours
- Reminder policy is user-managed only (no Airtable-managed admin policy in this feature).

### Quiet Hours Policy

- Quiet hours are enforced as **skip**.
- If a reminder `fire_at` falls inside quiet hours, it is not deferred; it is marked skipped and not sent later that day.

## Data Model (Postgres)

### `push_subscriptions_pg`

- Device/browser push endpoints per user.
- Stores endpoint + keys (`p256dh`, `auth`) + lifecycle status.

### `notification_preferences_pg`

- Per-user reminder settings and timezone.
- One row per user.
- Includes `reminder_mode`.

### `notification_jobs_pg`

- Async queue of planned/scheduled sends.
- Includes `fire_at`, `status`, retry metadata, `mode` (`session`/`daily_summary`), and `dedupe_key`.

### `notification_delivery_log_pg`

- Per-attempt delivery telemetry (status code, error, subscription).

## API Surface

- `POST /api/notifications/subscribe`
  - Upsert push subscription for authenticated user.
- `DELETE /api/notifications/subscribe`
  - Revoke/unregister device subscription.
- `GET /api/notifications/preferences`
  - Read current reminder settings.
- `PATCH /api/notifications/preferences`
  - Update reminder settings and trigger re-scheduling of future jobs.
- `POST /api/notifications/test` (non-production or admin-only)
  - Send a test notification to current user subscriptions.

## Worker Behavior

- Extend the existing worker loop to process due `notification_jobs_pg`.
- Retry transient failures with backoff.
- Mark 404/410 subscriptions as revoked.
- Do not send duplicate reminders for same dedupe key.
- Safety reconciler periodically regenerates missing future jobs from schedule + preferences.

## PWA / Service Worker Behavior

- Switch to a custom service worker entry so push events can be handled.
- On `push` event:
  - show notification with title/body/icon/badge
  - include deep-link target for Today Activity view
- On `notificationclick` event:
  - focus existing client or open target URL.

### Localization

- Notification copy must be localized using user `language_code`.
- Source of language is Airtable field `Taalcode`, synchronized to `users_pg.language_code`.

## In-App Fallback (Permission Denied)

- If push permission is denied, show an in-app reminder banner/card as fallback.
- Fallback reminder is visible on home/program surfaces and is user-dismissible for the day.

## Acceptance Criteria

### Functional

- [ ] Users can subscribe/unsubscribe from push on supported browsers.
- [ ] Preferences can be read/updated and persist in Postgres.
- [ ] Future sessions create notification jobs automatically.
- [ ] Reminder mode supports `session`, `daily_summary`, and `both`.
- [ ] Completed sessions do not trigger reminders.
- [ ] Reminders can be generated for both `running` and `planned` programs.
- [ ] Notification click deep-links to relevant screen.
- [ ] In-app reminder fallback is shown when push permission is denied.
- [ ] Reminders that fall inside quiet hours are skipped (not deferred).
- [ ] Notification tap opens Today Activity view.
- [ ] Notification copy is localized from `users_pg.language_code` (Airtable `Taalcode`).

### Reliability

- [ ] Delivery is async (not on request path).
- [ ] Idempotency prevents duplicate sends.
- [ ] Retries and dead/fatal handling are implemented.
- [ ] 404/410 subscription cleanup works automatically.

### Observability

- [ ] Health endpoint includes notification queue metrics.
- [ ] Logs include send attempts and failure reasons.
- [ ] Alert thresholds defined for backlog/lag/failure spikes.

### Security

- [ ] VAPID keys are stored in secrets, never in repo.
- [ ] Subscription endpoints require auth and ownership checks.
- [ ] Payload contains no sensitive personal data.

## Dependencies

- Browser Push API + Service Worker support.
- VAPID key pair.
- Existing Postgres + worker runtime.
- Existing program schedule data in Postgres.
