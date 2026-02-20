# Implementation Plan: Personal Goal Scheduling

## Overview

Add optional weekly day scheduling, push notification reminders, and a proper status lifecycle (Actief/Voltooid/Verwijderd) to personal goals. Version 1.2.0.

## Phase 1: Database Migration [LOW RISK]

### Tasks

- [x] Create `tasks/db/migrations/007_personal_goal_schedule.sql`
- [x] Add `schedule_days JSONB` column to `personal_goals_pg`
- [x] Add `status TEXT` column with CHECK constraint
- [x] Backfill status from `active` boolean
- [x] Add `personal_goal_id` FK on `notification_jobs_pg`
- [x] Expand notification mode constraint to include `personal_goal`

### Technical Details

```sql
ALTER TABLE personal_goals_pg ADD COLUMN IF NOT EXISTS schedule_days JSONB;
ALTER TABLE personal_goals_pg ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Actief';
-- Constraint: status IN ('Actief', 'Voltooid', 'Verwijderd', 'Gearchiveerd')
-- Index: idx_personal_goals_pg_user_status ON (user_id, status)
-- FK: notification_jobs_pg.personal_goal_id -> personal_goals_pg(id) ON DELETE CASCADE
```

## Phase 2: Repository Layer [LOW RISK]

### Tasks

- [x] Update `listPersonalGoalsByUser()` — filter by `status = 'Actief'` instead of `active = true`
- [x] Update `createPersonalGoalInPostgres()` — accept `scheduleDays`
- [x] Add `updatePersonalGoalInPostgres()` — dynamic UPDATE with ownership check
- [x] Add `deletePersonalGoalInPostgres()` — soft delete to 'Verwijderd'
- [x] Add `listScheduledPersonalGoalsForUser()` — active goals with schedule
- [x] Update `upsertPersonalGoal()` in usage repo — include `scheduleDays` + `status`

### Files Modified

- `api/_lib/repos/reference-repo.ts`
- `api/_lib/repos/personal-goal-usage-repo.ts`

## Phase 3: API Endpoints [MEDIUM RISK]

### Tasks

- [x] Extend POST `/api/personal-goals` with `scheduleDays` validation
- [x] Extend GET `/api/personal-goals` with `?include=voltooid`
- [x] Add Postgres dual-mode to `api/personal-goals/[id].ts` (was Airtable-only)
- [x] Add `handlePatchPostgres()` and `handleDeletePostgres()` handlers
- [x] Switch `[id].ts` to `requireAuth()` for Postgres path

### Technical Details

`VALID_DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]`

Zod schema extended with `scheduleDays: z.array(z.string()).max(7).optional()` and day name validation.

## Phase 4: Notification Planner [LOW RISK]

### Tasks

- [x] Add `"personal_goal"` to `NotificationJobPayload.mode` union
- [x] Add `personalGoalId` to `NotificationJobCandidate` and `NotificationJobRow`
- [x] Update `upsertNotificationJobs()` INSERT with `personal_goal_id`
- [x] Add `getUpcomingDatesForSchedule()` helper
- [x] Add `buildPersonalGoalPayload()` with NL/EN/FR text
- [x] Extend `syncNotificationJobsForUser()` with personal goal reminders

### Files Modified

- `api/_lib/notifications/types.ts`
- `api/_lib/repos/notification-job-repo.ts`
- `api/_lib/notifications/planner.ts`

## Phase 5: Airtable Sync [MEDIUM RISK]

### Tasks

- [x] Add `scheduleDays` field mapping with placeholder ID
- [x] Update `transformPersonalGoal()` to parse scheduleDays
- [x] Update `upsertPersonalGoal()` writer — partial-update safe, write scheduleDays + status
- [x] Update `syncPersonalGoalsFromAirtable()` — read scheduleDays + status from Airtable

### Files Modified

- `api/_lib/field-mappings.js`
- `api/_lib/sync/airtable-writers.ts`
- `api/_lib/sync/full-sync.ts`

### Action Required

Before deploy: create "Planningdagen" field in Airtable Persoonlijke Doelen table, get field ID, replace `fldPLACEHOLDER_SCHEDULE` in `field-mappings.js`.

## Phase 6: Frontend Types [LOW RISK]

### Tasks

- [x] Update `PersonalGoal` interface — status enum + `scheduleDays`
- [x] Update `CreatePersonalGoalData` — add `scheduleDays`
- [x] Update `UpdatePersonalGoalData` — status enum + `scheduleDays`

### File Modified

- `src/types/program.ts`

## Phase 7: PersonalGoalDialog Day Picker [LOW RISK]

### Tasks

- [x] Add collapsible "Planning (optioneel)" section below description
- [x] 7 day buttons in 2-column grid with toggle selection
- [x] Pre-populate days when editing existing goal
- [x] Pass `scheduleDays` in create/update mutations

### File Modified

- `src/components/PersonalGoalDialog.tsx`

## Phase 8: PersonalGoalsSection — Home Page [LOW RISK]

### Tasks

- [x] Sort goals: scheduled-for-today first
- [x] Show "Gepland voor vandaag" indicator with CalendarCheck icon
- [x] Show abbreviated schedule days in expanded view (Ma, Di, etc.)

### File Modified

- `src/components/PersonalGoalsSection.tsx`

## Phase 9: AccountPage Goal Management [LOW RISK]

### Tasks

- [x] Add "Markeer als voltooid" button (CheckCircle2 icon)
- [x] Show schedule days below goal name in muted text
- [x] PATCH status to Voltooid on complete action

### File Modified

- `src/pages/AccountPage.tsx`

## Phase 10: i18n [LOW RISK]

### Tasks

- [x] Add NL/FR/EN translations for scheduling UI strings
- [x] Keys: scheduledToday, scheduleOptional, selectDays, daysSelected, markCompleted, confirmCompleted, confirmDelete, completedGoals, reactivate

### File Modified

- `src/lib/i18n-fallback.ts`

## Phase Dependencies

```
Phase 1 (migration) -> Phase 2 (repos) -> Phase 3 (API)
                                              |
                                    +---------+---------+
                                    |         |         |
                                Phase 4    Phase 5   Phase 6
                              (planner)  (airtable)  (types)
                                                       |
                                              +--------+---------+
                                              |        |         |
                                          Phase 7   Phase 8   Phase 9
                                         (dialog)   (home)   (account)
                                              +--------+---------+
                                                       |
                                                  Phase 10 (i18n)
```

## Verification Checklist

1. [x] Migration: columns exist, existing goals accessible
2. [x] API: Create goal with scheduleDays, verify stored
3. [x] API: PATCH status to Voltooid, verify lifecycle
4. [x] Home page: Scheduled-for-today goals first with indicator
5. [x] Dialog: Day picker works for create and edit
6. [x] Account: Voltooid action archives goal
7. [ ] Notifications: Scheduled goal generates notification_jobs_pg entries
8. [ ] Airtable sync: Goal syncs with schedule_days + status (requires real field ID)
9. [x] Build: `npm run build` passes
