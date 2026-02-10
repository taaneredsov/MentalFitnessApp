# Action Required: Push Notifications for Scheduled Activities

Manual tasks remaining after implementation.

## Product Decisions (Confirmed)

- [x] **Reminder ownership model**
  - User-managed preferences only (no Airtable-managed admin policy in this feature).
- [x] **Reminder styles**
  - Both are supported: per-session reminders and daily summary reminders.
- [x] **Permission denied behavior**
  - Show an in-app fallback reminder banner/card.
- [x] **Program scope**
  - Send reminders for both `running` and `planned` programs.

## Product Decisions (Finalized)

- [x] **Reminder timing model**
  - Date-only schedule + user preferred reminder time.
- [x] **Quiet hours behavior**
  - Skip reminders during quiet hours (no defer).
- [x] **Deep-link target**
  - Today activity view.
- [x] **Notification copy language**
  - Use `language_code` per user (Airtable field `Taalcode`).

## Security and Infrastructure

- [ ] **Generate VAPID keys** for each environment (dev/staging/prod).
- [ ] **Store VAPID keys in secrets manager** (not repo/env file committed).
- [ ] **Confirm web push subject** email/URL for compliance.
- [ ] **Review data retention policy** for delivery logs.

## Browser/Platform Readiness

- [ ] **Define supported matrix**
  - iOS (installed PWA only), Android Chrome, desktop Chrome/Edge/Firefox/Safari.
- [ ] **Test installed-PWA flow on iOS** (permission UX differs from browser tab).

## Operations

- [ ] **Define alert thresholds**
  - queue backlog age
  - dead-letter growth
  - delivery failure rate
- [ ] **Assign ownership** for notification incident triage and replay.
- [ ] **Create runbook** for dead-letter replay and subscription cleanup.

## Implemented Default Values

- [x] `enabled = true`
- [x] `reminder_mode = both`
- [x] `reminder_lead_minutes = 60`
- [x] `preferred_time_local = 19:00`
- [x] `quiet_hours = 22:00-07:00`
- [x] max retries = `6`

---

> Keep this checklist aligned with `requirements.md` and `implementation-plan.md` as tasks are completed.
