# Requirements: Goede Gewoontes (Good Habits)

> **Updated 2026-02-24**: Refactored from Methodes-based filtering to standalone Airtable tables with Postgres sync.

## Overview

"Goede Gewoontes" are daily good habits that users practice alongside their mental fitness program. They are separate from training methods - they represent simple lifestyle habits (drink water, stretch, eat healthy) that users check off daily for bonus points.

## Architecture

### Data Source (Current)

Goede Gewoontes use **dedicated Airtable tables** (not the Methodes table):

| Table | Airtable ID | Purpose |
|-------|------------|---------|
| Goede gewoontes | `tblg0lHLnqYIkfvPV` | Reference table (name, notes) |
| Goede gewoontes gebruik | `tbl3PAonRhbzyIe0o` | Usage tracking (user, habit, date) |

### Field Mappings

**Goede gewoontes (reference)**:
- `fldVR1yiFbpLaafe4` - Name
- `fldz1n17gRwkoUmge` - Notes

**Goede gewoontes gebruik (usage)**:
- `fld0M8vf1Tx20OomS` - Name
- `fldLIzVxJ5TmPtwBJ` - Gebruikers (linked user)
- `fld23ht8gYEFQ3r4U` - Goede gewoontes (linked habit)
- `fldRVMJX7okGCVxDM` - Programma (linked program)
- `fldLDuoW175HMOl4W` - Datum

### Postgres Tables

- `reference_goede_gewoontes_pg` - Synced from Airtable reference table
- `goede_gewoontes_usage_pg` - Usage records with UNIQUE(user_id, goede_gewoonte_id, usage_date)
- `users_pg.goede_gewoontes` - JSONB column storing user's selected habit IDs (max 3)

## User Stories

### US-1: View Good Habits
**As a** user on the homepage
**I want to** see my selected good habits
**So that** I'm reminded to practice them daily

### US-2: Track Daily Completion
**As a** user
**I want to** check off good habits I've completed today
**So that** I earn bonus points and build consistency

### US-3: AI Selection During Onboarding
**As a** new user creating my first program
**I want the** AI to suggest up to 3 good habits for me
**So that** I start with relevant daily habits without manual selection

## Functional Requirements

### FR-1: Homepage Display
- Show "Goede Gewoontes" section on HomePage
- Display user's selected habits (from `users_pg.goede_gewoontes`)
- If no habits selected, show all available habits as fallback
- Each habit shows name and checkbox for today's completion
- Optimistic UI updates on check/uncheck

### FR-2: Daily Completion Tracking
- Users can check a habit once per day (UNIQUE constraint enforced)
- Checking awards 10 bonus points via rewards engine
- Unchecking removes the usage record for that date
- Completion state resets daily

### FR-3: AI Integration
- AI program generation selects up to 3 goede gewoontes
- Selection based on user's goals and profile
- AI provides a reason for each selection
- Selections shown on ProgramResult page after program creation
- Confirm endpoint saves selections to `users_pg.goede_gewoontes`

### FR-4: Airtable Sync
- Usage records sync to Airtable via outbox pattern
- Entity type: `goede_gewoonte_usage`
- Reference data synced from Airtable during full sync

## API Endpoints

### GET /api/methods/habits
Returns user's selected goede gewoontes (or all if none selected).

### POST /api/habit-usage
Records a habit completion for a date.
Body: `{ userId, goedeGewoonteId, date }`

### DELETE /api/habit-usage
Removes a habit completion.
Query: `?userId=...&goedeGewoonteId=...&date=...`

### GET /api/habit-usage
Returns completed habit IDs for a date.
Query: `?date=YYYY-MM-DD`

## Key Implementation Files

| File | Purpose |
|------|---------|
| `api/_lib/repos/goede-gewoonte-usage-repo.ts` | CRUD for usage records |
| `api/_lib/repos/reference-repo.ts` | `listAllGoedeGewoontes()`, `lookupByIds()` |
| `api/_lib/repos/user-repo.ts` | `updateUserGoedeGewoontes()`, `getUserGoedeGewoontes()` |
| `api/habit-usage/index.ts` | Usage API endpoint |
| `api/methods/habits.ts` | Returns user's selected habits |
| `api/_lib/sync/airtable-writers.ts` | `upsertGoedeGewoonteUsage()` |
| `api/_lib/sync/full-sync.ts` | Reference data sync |
| `api/_lib/openai.ts` | AI schema with `selectedGoedeGewoontes` |
| `api/_lib/program-generation-data.ts` | Loads goede gewoontes for AI |
| `api/programs/preview.ts` | Returns AI-suggested goede gewoontes |
| `api/programs/confirm.ts` | Saves selections to user record |
| `src/components/GoodHabitsSection.tsx` | Homepage UI component |
| `src/components/AIProgramWizard/ProgramResult.tsx` | Shows selections after onboarding |
| `src/hooks/queries.ts` | React Query hooks with optimistic updates |
| `tasks/db/migrations/014_goede_gewoontes.sql` | Database migration |

## Important Constraints

- **NOT part of the Mentaal Fitness Programma** - goede gewoontes are independent of program schedule
- **Max 3 selection** - AI selects up to 3, enforced in schema
- **Usage NOT linked to a program** - usage records are standalone daily habits
- **Suggested during onboarding only** - at end of first program creation (ProgramResult page)

## Acceptance Criteria

- [x] Goede Gewoontes section appears on HomePage
- [x] Users can check/uncheck habits daily
- [x] Points awarded on completion
- [x] Optimistic UI updates
- [x] AI selects up to 3 during program creation
- [x] Selections shown on ProgramResult page
- [x] Selections saved to user record on confirm
- [x] Airtable sync via outbox
- [ ] End-to-end test after deploy
- [ ] Migration 014 run on production
