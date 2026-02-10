# Implementation Review: Push Notifications

## Status

Implemented on branch `feat/postgres-airtable-async-sync` with Postgres + worker + PWA integration.

## Implemented

- Database migration:
  - `tasks/db/migrations/004_push_notifications.sql`
- Backend modules:
  - `api/_lib/repos/notification-preference-repo.ts`
  - `api/_lib/repos/notification-subscription-repo.ts`
  - `api/_lib/repos/notification-job-repo.ts`
  - `api/_lib/notifications/planner.ts`
  - `api/_lib/notifications/worker.ts`
  - `api/_lib/notifications/web-push.ts`
  - `api/_lib/notifications/time.ts`
  - `api/_lib/notifications/types.ts`
- API endpoints:
  - `api/notifications/subscribe.ts` (`POST`, `DELETE`)
  - `api/notifications/preferences.ts` (`GET`, `PATCH`)
  - `api/notifications/test.ts` (`POST`)
- Server route wiring:
  - `server.ts`
- Worker integration:
  - `api/workers/sync-worker.ts` (notification processing + reconcile loop)
  - `api/workers/backfill.ts` (post-backfill notification planning)
- Observability:
  - `api/health.ts` includes notification queue stats.
- Frontend:
  - `src/lib/push.ts`
  - `src/types/notifications.ts`
  - `src/lib/api-client.ts` notification client methods
  - `src/hooks/queries.ts` notification hooks
  - `src/pages/AccountPage.tsx` notification settings + subscribe/unsubscribe/test actions
  - `src/components/InAppReminderBanner.tsx`
  - `src/pages/HomePage.tsx` fallback banner
  - `src/pages/ProgramDetailPage.tsx` fallback banner
  - `vite.config.ts` switched to `injectManifest`
  - `src/sw.js` custom SW for push + click behavior + skip waiting

## Behavior Implemented

- User-managed notification settings only.
- Reminder modes:
  - `session`
  - `daily_summary`
  - `both`
- Scope:
  - running and planned programs
- Timing:
  - date-only schedule + user preferred reminder time + lead minutes
- Quiet hours:
  - reminders are skipped (not deferred)
- Localization:
  - uses `users_pg.language_code` (Airtable `Taalcode`)
- Fallback:
  - in-app reminder banner on Home and Program detail when browser permission is denied

## Validation Run

- `npm run build:server` passes.
- `npx tsc -b` passes.
- `npm run db:migrate` applies `004_push_notifications.sql` successfully.
- `npm run build` is blocked by local Tailwind optional-native binding issue in this environment (not a TypeScript code failure).

## Remaining Manual/Ops

- Configure VAPID keys + subject in deployment secrets.
- Run browser/device validation matrix (iOS installed PWA, Android, desktop).
- Run pilot rollout and monitor queue metrics and delivery rates.
