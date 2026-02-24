# Score Architecture Redesign: App-Calculated Scores

**Date**: 2026-02-24
**Version target**: 1.4.0 (minor bump - architectural change)

## Problem Statement

Scores are broken in `postgres_primary` mode. The app historically relied on Airtable formula fields to calculate scores. Now that Postgres is the primary backend, all scoring logic must live in the app. Airtable becomes a passive mirror that stores (but does not calculate) scores.

## Current Architecture (broken)

### How scores SHOULD flow but DON'T fully work:

```
User completes activity
  → API writes to Postgres usage table
  → API calls awardRewardActivity() → updates bonusPoints, streak, badges, level on users_pg
  → Outbox syncs usage record + user reward fields to Airtable
  → GET /api/rewards → queries Postgres counts → calculates split scores on-the-fly
```

### The Problem: Score fields in Airtable are FORMULA fields

In Airtable, these 4 fields are **formula fields** (read-only, calculated by Airtable):
- `totalPoints` (fldRcrVTHrvSUe1Mh) — Formula
- `mentalFitnessScore` (fldMTUjMC2vcY0HWA) — Formula: `(# linked method_usage records * 10) + bonusPoints`
- `personalGoalsScore` (fldVDpa3GOFSWTYly) — Formula: `(# linked personal_goal_usage records * 10)`
- `goodHabitsScore` (fldpW5r0j9aHREqaK) — Formula: `(# linked goede_gewoonte_usage records * 5)`

These formulas count **linked records** in the Airtable usage tables. They work when:
- Airtable is the primary backend (usage records written directly to Airtable)
- Sync successfully writes ALL usage records back to Airtable

They BREAK when:
- Postgres is primary and outbox sync is delayed/failed
- The formulas count Airtable-side linked records, which may not match Postgres counts

### What the Postgres rewards endpoint ALREADY does correctly

In `api/rewards/index.ts` → `handleGetPostgres()`:
```typescript
mentalFitnessScore: methodCount * 10 + user.bonusPoints,
personalGoalsScore: personalGoalCount * 10,
goodHabitsScore: habitCount * 5,
totalPoints: (methodCount * 10) + (personalGoalCount * 10) + (habitCount * 5) + user.bonusPoints
```

This is **already correct** — scores are calculated from Postgres counts. The issue is that these calculated values are NOT being persisted to Postgres or synced back to Airtable.

## Research Findings

### Score Calculation (already in app)
- **Reward engine**: `api/_lib/rewards/engine.ts` — levels, badges, streaks, bonus points
- **Reward endpoint**: `api/rewards/index.ts` — calculates split scores on-the-fly from Postgres counts
- **Streak utils**: `api/_lib/repos/streak-utils.ts` — consecutive day tracking
- **Points system**: method=10pts, habit=5pts, personalGoal=10pts, overtuiging=1pt bonus

### Score Display (frontend)
- **ScoreWidgets.tsx** — displays 3 split scores from `GET /api/rewards`
- **UserRewards type** — `mentalFitnessScore`, `personalGoalsScore`, `goodHabitsScore`
- Frontend does NOT calculate scores — it receives pre-calculated values from API

### Sync Architecture (Postgres → Airtable)
- **Outbox pattern**: usage records written to `sync_outbox`, worker syncs to Airtable
- **User reward sync**: `airtable-writers.ts` syncs bonusPoints, streak, badges, level to Airtable user record
- **Missing**: totalPoints and split scores are NOT synced to Airtable (they're formula fields = can't write to them)

### Airtable Score Fields (must change)
| Field | Current Type | Field ID | Must Change To |
|-------|-------------|----------|---------------|
| totalPoints | Formula | fldRcrVTHrvSUe1Mh | **Number** |
| mentalFitnessScore | Formula | fldMTUjMC2vcY0HWA | **Number** |
| personalGoalsScore | Formula | fldVDpa3GOFSWTYly | **Number** |
| goodHabitsScore | Formula | fldpW5r0j9aHREqaK | **Number** |

### Fields that stay writable (already correct)
| Field | Type | Field ID |
|-------|------|----------|
| bonusPoints | Number | fldnTqsjBrzV37WPG |
| currentStreak | Number | fldDsfIZH929xN30H |
| longestStreak | Number | fldUI14lfcoJAI329 |
| lastActiveDate | Date | fldwl4wC7pT4hKZVN |
| badges | Long text (JSON) | fldMbIUw4uzjNKYy9 |
| level | Number | fldBp9BHyhbiGxK8V |

## Proposed Changes

### 1. Airtable Changes (manual, by user)

Convert these 4 formula fields to Number fields:
- `totalPoints` (fldMTUjMC2vcY0HWA → Number)
- `mentalFitnessScore` (fldMTUjMC2vcY0HWA → Number)
- `personalGoalsScore` (fldVDpa3GOFSWTYly → Number)
- `goodHabitsScore` (fldpW5r0j9aHREqaK → Number)

**Important**: When converting formula→number in Airtable, the field IDs stay the same. No code changes needed for field ID references.

### 2. App Changes: Persist calculated scores to users_pg

**Migration**: Add score columns to `users_pg`:
```sql
ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;
ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS mental_fitness_score INTEGER DEFAULT 0;
ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS personal_goals_score INTEGER DEFAULT 0;
ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS good_habits_score INTEGER DEFAULT 0;
```

### 3. App Changes: Update scores on every activity

In the reward engine (`awardRewardActivity`), after calculating counts:
- Compute the 4 score values
- Persist them to `users_pg` alongside bonusPoints/streak/etc.
- The existing outbox sync for user reward fields already runs — just add the 4 new fields to the sync payload

### 4. App Changes: Sync scores to Airtable

In `airtable-writers.ts` → user reward sync, add the 4 score fields to the write payload:
```typescript
fields: {
  ...existingRewardFields,
  [USER_FIELDS.totalPoints]: totalPoints,
  [USER_FIELDS.mentalFitnessScore]: mentalFitnessScore,
  [USER_FIELDS.personalGoalsScore]: personalGoalsScore,
  [USER_FIELDS.goodHabitsScore]: goodHabitsScore,
}
```

### 5. App Changes: GET /api/rewards reads from stored values

Instead of recalculating on every GET, read the persisted scores from `users_pg`. This is faster and ensures consistency. Recalculation happens only on activity (write path).

### 6. Backfill: One-time recalculation for existing users

A migration script or API endpoint that:
1. For each user, counts all usage records
2. Calculates the 4 scores
3. Updates `users_pg`
4. Triggers outbox sync to update Airtable

## Files to Modify

| File | Change |
|------|--------|
| `tasks/db/migrations/017_score_columns.sql` | Add 4 score columns to users_pg |
| `api/_lib/rewards/engine.ts` | Compute & persist scores on activity |
| `api/_lib/repos/user-repo.ts` | Add score fields to user update queries |
| `api/_lib/sync/airtable-writers.ts` | Include scores in user reward sync to Airtable |
| `api/_lib/field-mappings.js` | Verify score field IDs are in USER_FIELDS (already there) |
| `api/rewards/index.ts` | Read stored scores instead of recalculating |
| `api/_lib/rewards/backfill.ts` | New: one-time score recalculation for all users |

## Airtable Changes Required (User Action)

1. **Gebruikers table** → field `totalPoints`: Change from Formula to Number
2. **Gebruikers table** → field `mentalFitnessScore`: Change from Formula to Number
3. **Gebruikers table** → field `personalGoalsScore`: Change from Formula to Number
4. **Gebruikers table** → field `goodHabitsScore`: Change from Formula to Number

**Timing**: Do this AFTER deploying the app changes. The app will then immediately start writing calculated scores to these fields via the outbox sync. Run the backfill to populate historical scores.

## Risk Assessment

- **Low risk**: Frontend doesn't change at all — it already reads pre-calculated scores from API
- **Low risk**: Score calculation formulas are already correct in the app
- **Medium risk**: Airtable field type conversion (formula→number) — test in a dev base first
- **Low risk**: Backfill is a one-time operation, can be re-run if needed
