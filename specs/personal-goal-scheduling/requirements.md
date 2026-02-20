# Requirements: Personal Goal Scheduling

## Overview

Extend existing personal goals with optional weekly day-of-week scheduling (e.g. "every Tuesday & Thursday"), push notification reminders, and a proper lifecycle: Actief -> Voltooid (achieved) / Verwijderd (removed).

## User Stories

### As a user, I want to:
1. Schedule personal goals on specific days of the week (e.g. Monday, Wednesday, Friday)
2. See which goals are scheduled for today, prioritized at the top of the list
3. Receive push notification reminders on scheduled days
4. Mark a goal as "Voltooid" (completed/achieved) when I no longer need it
5. Delete goals permanently ("Verwijderd")
6. View my completed goals and optionally reactivate them

## Acceptance Criteria

### Scheduling
- [x] Day picker with 7 Dutch day buttons (Maandag-Zondag) in goal create/edit dialog
- [x] Scheduling is optional — goals work without a schedule
- [x] Schedule stored as JSONB array of Dutch day names in Postgres
- [x] Schedule synced to Airtable as comma-separated string in "Planningdagen" field

### Home Page Display
- [x] Goals scheduled for today appear first in the list
- [x] Scheduled-for-today goals show "Gepland voor vandaag" with CalendarCheck icon
- [x] Expanded view shows abbreviated schedule days (Ma, Di, Wo, etc.)

### Status Lifecycle
- [x] Goals have a `status` field: Actief, Voltooid, Verwijderd (+ legacy Gearchiveerd)
- [x] "Markeer als voltooid" action on AccountPage (status -> Voltooid)
- [x] "Verwijderen" action on AccountPage (status -> Verwijderd)
- [x] Only Actief goals shown in main list; Voltooid goals visible in collapsed section

### Push Notifications
- [x] Notification planner generates `personal_goal` jobs for scheduled goals
- [x] 14-day look-ahead window for job generation
- [x] Deduplicated via `pgoal:{goalId}:user:{userId}:date:{date}:lead:{leadMinutes}` key
- [x] Localized notification text (NL/EN/FR)

### Airtable Sync
- [x] Schedule days synced to Airtable on create/update
- [x] Status changes synced (Actief, Voltooid)
- [x] Partial updates don't corrupt other fields
- [x] Delete event hard-removes record from Airtable

## Dependencies

- Existing personal goals feature (`specs/personal-goals/`)
- Push notification system (`specs/push-notifications/`)
- Postgres + outbox sync (`specs/postgres-airtable-async-sync/`)
- Airtable "Planningdagen" field (must be created manually before deploy)

## Out of Scope

- Time-of-day scheduling (e.g. "remind me at 9am")
- Goal streaks / completion percentage tracking
- Recurring goal templates
- Social/shared goals
