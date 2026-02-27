# Rewards System Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the scoring, streaks, badges, and levels system to incentivize consistent program usage over a 1-year journey.

**Architecture:** Variable method points from Airtable, program-aligned streaks computed from Programmaplanning completion, journey-based badges in 3 tiers, recalibrated levels, no inactivity score wipe.

**Tech Stack:** Express API (TypeScript), Postgres + Airtable dual backend, React 19 + TanStack Query v5 frontend, Vitest for testing.

**Design doc:** `docs/plans/2026-02-27-rewards-system-redesign.md`

---

## Task 1: Add `pointsValue` to Method Data Pipeline

**Files:**
- Modify: `api/_lib/field-mappings.js:138-150` (METHOD_FIELDS)
- Modify: `api/_lib/field-mappings.js:506-520` (transformMethod)
- Modify: `api/methods/index.ts` (verify response includes pointsValue)

**Step 1: Add field mapping**

In `api/_lib/field-mappings.js`, add to METHOD_FIELDS (after line 149):
```js
pointsValue: "fldcyKMc8Q02H2QGN"    // Punten waarde (1-10)
```

**Step 2: Add to transform**

In `transformMethod` (line 506-520), add after `media`:
```js
pointsValue: Number(fields[METHOD_FIELDS.pointsValue]) || 5  // default 5 if unset
```

**Step 3: Verify API response**

Run: `curl localhost:3333/api/methods | jq '.[0].pointsValue'`
Expected: a number 1-10 (or 5 as default)

**Step 4: Commit**
```bash
git add api/_lib/field-mappings.js
git commit -m "feat: add pointsValue field to method data pipeline"
```

---

## Task 2: Add `pointsValue` to Method Postgres Repo

**Files:**
- Modify: `api/_lib/repos/reference-repo.ts:25-34` (getMethodById)

**Context:** `reference_methods_pg` stores full Airtable payload as JSONB, so the field data is already synced. `getMethodById` returns `transformMethod(...)` which now includes `pointsValue` from Task 1. This step verifies that path works and adds a helper to extract just the points value for the rewards engine.

**Step 1: Add helper function**

In `api/_lib/repos/reference-repo.ts`, add after `getMethodById`:
```typescript
export async function getMethodPointsValue(methodId: string): Promise<number> {
  const method = await getMethodById(methodId)
  if (!method) return 5 // safe default
  return Number((method as Record<string, unknown>).pointsValue) || 5
}
```

**Step 2: Commit**
```bash
git add api/_lib/repos/reference-repo.ts
git commit -m "feat: add getMethodPointsValue helper"
```

---

## Task 3: Wire Method Usage to Award Points

**Files:**
- Modify: `api/method-usage/index.ts:58-129` (handlePostPostgres)
- Modify: `api/method-usage/index.ts` (handlePostAirtable equivalent)

**Step 1: Import dependencies**

At the top of `api/method-usage/index.ts`, add:
```typescript
import { awardRewardActivity } from "../_lib/rewards/engine.js"
import { getMethodPointsValue } from "../_lib/repos/reference-repo.js"
```

**Step 2: Add reward awarding to handlePostPostgres**

After the `enqueueSyncEvent` call and before the response, add:
```typescript
let pointsAwarded = 0
try {
  const methodPoints = await getMethodPointsValue(body.methodId)
  await awardRewardActivity({
    userId: auth.userId,
    activityType: "method",
    activityDate: new Date().toISOString().slice(0, 10),
    forcePostgres: true
  })
  pointsAwarded = methodPoints
} catch (err) {
  console.error("[method-usage] awardRewardActivity failed:", err)
}
```

Update the response to include `pointsAwarded`.

**Step 3: Add reward awarding to handlePostAirtable**

Same pattern — add `awardRewardActivity` call after Airtable record creation (without `forcePostgres`).

**Step 4: Commit**
```bash
git add api/method-usage/index.ts
git commit -m "feat: wire method usage to award reward points"
```

---

## Task 4: Variable Method Points in Rewards Engine

**Files:**
- Modify: `api/_lib/rewards/engine.ts:229-231` (toBaseTotalPoints)
- Modify: `api/_lib/rewards/engine.ts:460-548` (awardPostgres — mentalFitnessScore calc)
- Modify: `api/_lib/repos/user-repo.ts:324-352` (getUserRewardStats — add sum query)

**Step 1: Update getUserRewardStats to compute mentalFitnessScore from actual method points**

In `api/_lib/repos/user-repo.ts`, change the methods count query (line 329) from:
```sql
SELECT COUNT(*) as count FROM method_usage_pg WHERE user_id = $1
```
To a query that also gets the sum of points:
```sql
SELECT COUNT(*) as count,
       COALESCE(SUM(
         COALESCE((SELECT (payload->>'fldcyKMc8Q02H2QGN')::int
                   FROM reference_methods_pg rm
                   WHERE rm.id = mu.method_id), 5)
       ), 0) as points_sum
FROM method_usage_pg mu WHERE mu.user_id = $1
```

Add `methodPointsSum` to the return type and value.

**Step 2: Update awardPostgres mentalFitnessScore**

In `api/_lib/rewards/engine.ts:504`, change:
```typescript
const mentalFitnessScore = stats.methodCount * 10 + nextState.bonusPoints
```
To:
```typescript
const mentalFitnessScore = stats.methodPointsSum + nextState.bonusPoints
```

**Step 3: Update toBaseTotalPoints**

Change `(stats.methodCount * 10)` to `(stats.methodPointsSum)`.

**Step 4: Update rewards GET endpoint**

In `api/rewards/index.ts:88-97`, update fallback calculations to use `methodPointsSum` instead of `methodCount * 10`.

**Step 5: Commit**
```bash
git add api/_lib/repos/user-repo.ts api/_lib/rewards/engine.ts api/rewards/index.ts
git commit -m "feat: variable method points in rewards engine"
```

---

## Task 5: Update Frontend Types and Constants

**Files:**
- Modify: `src/types/rewards.ts:50-81` (POINTS, LEVELS)

**Step 1: Update POINTS**

```typescript
export const POINTS = {
  // Method points are variable (1-10, from Airtable "Punten waarde")
  // No fixed method constant — read from method record
  habit: 5,
  personalGoal: 5,
  overtuiging: 1,
  // Streak bonuses (program-aligned)
  streak7: 25,
  streak21: 75,
  programComplete: 100
} as const
```

**Step 2: Update LEVELS**

```typescript
export const LEVELS = [
  { level: 1, points: 0, title: "Beginner" },
  { level: 2, points: 50, title: "Ontdekker" },
  { level: 3, points: 125, title: "Beoefenaar" },
  { level: 4, points: 250, title: "Doorzetter" },
  { level: 5, points: 400, title: "Gevorderde" },
  { level: 6, points: 600, title: "Expert" },
  { level: 7, points: 850, title: "Kampioen" },
  { level: 8, points: 1150, title: "Meester" },
  { level: 9, points: 1500, title: "Legende" },
  { level: 10, points: 2000, title: "Mentale Atleet" }
] as const
```

**Step 3: Update BADGES**

Replace the 14-badge BADGES constant with the new 12 journey-based badges:

```typescript
export const BADGES = {
  // Tier 1: Eerste Stappen
  eerste_sessie: { id: "eerste_sessie", name: "Eerste Sessie", description: "Voltooi je eerste methode", icon: "star", tier: 1 },
  eerste_streak: { id: "eerste_streak", name: "Eerste Streak", description: "3 opeenvolgende sessies op tijd", icon: "flame", tier: 1 },
  eerste_week: { id: "eerste_week", name: "Eerste Week", description: "Alle sessies voltooid in week 1", icon: "calendar-check", tier: 1 },
  goede_start: { id: "goede_start", name: "Goede Start", description: "Log je eerste gewoonte of persoonlijk doel", icon: "heart", tier: 1 },
  // Tier 2: Consistentie
  op_dreef: { id: "op_dreef", name: "Op Dreef", description: "21 opeenvolgende sessies op tijd", icon: "zap", tier: 2 },
  tweede_programma: { id: "tweede_programma", name: "Tweede Programma", description: "Start een 2e programma", icon: "refresh-cw", tier: 2 },
  drie_maanden: { id: "drie_maanden", name: "Drie Maanden", description: "3 maanden actief", icon: "clock", tier: 2 },
  veelzijdig: { id: "veelzijdig", name: "Veelzijdig", description: "Methode + gewoonte + doel in één week", icon: "layers", tier: 2 },
  // Tier 3: Mentale Atleet
  programma_voltooid: { id: "programma_voltooid", name: "Programma Voltooid", description: "Rond een volledig programma af", icon: "trophy", tier: 3 },
  zes_maanden: { id: "zes_maanden", name: "Zes Maanden", description: "6 maanden actief", icon: "shield", tier: 3 },
  jaar_actief: { id: "jaar_actief", name: "Jaar Actief", description: "12 maanden actief", icon: "crown", tier: 3 },
  mentale_atleet: { id: "mentale_atleet", name: "Mentale Atleet", description: "Bereik niveau 8", icon: "medal", tier: 3 }
} as const
```

**Step 4: Commit**
```bash
git add src/types/rewards.ts
git commit -m "feat: update frontend POINTS, LEVELS, BADGES constants"
```

---

## Task 6: Rewrite Badge Logic in Rewards Engine

**Files:**
- Modify: `api/_lib/rewards/engine.ts` (checkNewBadges function)

**Step 1: Rewrite checkNewBadges**

Replace the current count-based badge logic with journey-based triggers. The function receives `state` (RewardState), `counts` (UserRewardStats), and `activityType`.

New badge checks:
```typescript
// Tier 1
if (counts.methodCount >= 1) tryAward("eerste_sessie")
if (state.currentStreak >= 3) tryAward("eerste_streak")
// eerste_week — checked separately when program week 1 completes
if (counts.habitCount >= 1 || counts.personalGoalCount >= 1) tryAward("goede_start")

// Tier 2
if (state.currentStreak >= 21) tryAward("op_dreef")
if (counts.programsStarted >= 2) tryAward("tweede_programma")
if (counts.monthsActive >= 3) tryAward("drie_maanden")
// veelzijdig — checked separately (method + habit + goal in one week)

// Tier 3
if (counts.programsCompleted >= 1) tryAward("programma_voltooid")
if (counts.monthsActive >= 6) tryAward("zes_maanden")
if (counts.monthsActive >= 12) tryAward("jaar_actief")
if (nextLevel >= 8) tryAward("mentale_atleet")
```

**Step 2: Add monthsActive and programsStarted to UserRewardStats**

In `api/_lib/repos/user-repo.ts` `getUserRewardStats`, add queries:
```sql
-- months active (distinct months with any activity)
SELECT COUNT(DISTINCT to_char(used_at, 'YYYY-MM')) as count
FROM method_usage_pg WHERE user_id = $1

-- programs started
SELECT COUNT(*) as count FROM programs_pg WHERE user_id = $1
```

**Step 3: Update calculateBonusAward for new streak bonuses**

Change streak bonuses from (7-day: 50pts, 30-day: 200pts) to:
- 7-session: +25 pts
- 21-session: +75 pts

**Step 4: Commit**
```bash
git add api/_lib/rewards/engine.ts api/_lib/repos/user-repo.ts
git commit -m "feat: journey-based badge logic and updated streak bonuses"
```

---

## Task 7: Program-Aligned Streak Calculation

**Files:**
- Modify: `api/_lib/rewards/engine.ts` (streak calculation in buildAwardResult)
- Modify: `api/_lib/repos/user-repo.ts` (add streak query helpers)

**Step 1: Add streak query helper**

In `api/_lib/repos/user-repo.ts`, add:
```typescript
export async function getScheduledSessionStreak(userId: string): Promise<number> {
  // Count consecutive Programmaplanning sessions that have method_usage_ids populated,
  // ordered by scheduled date descending, stopping at first gap
  const result = await dbQuery<{ planned_date: string; is_completed: boolean }>(
    `SELECT pp.planned_date,
            (pp.method_usage_ids IS NOT NULL AND array_length(pp.method_usage_ids, 1) > 0) as is_completed
     FROM programmaplanning_pg pp
     JOIN programs_pg p ON p.id = pp.program_id
     WHERE p.user_id = $1 AND pp.planned_date <= CURRENT_DATE
     ORDER BY pp.planned_date DESC`,
    [userId]
  )
  let streak = 0
  for (const row of result.rows) {
    if (row.is_completed) {
      streak++
    } else {
      break
    }
  }
  return streak
}
```

**Step 2: Update streak logic in buildAwardResult**

Replace daily streak calculation with call to `getScheduledSessionStreak`. Update `currentStreak` based on program schedule, not calendar days.

**Step 3: Commit**
```bash
git add api/_lib/rewards/engine.ts api/_lib/repos/user-repo.ts
git commit -m "feat: program-aligned streak calculation"
```

---

## Task 8: Remove 90-Day Score Wipe

**Files:**
- Modify: `api/rewards/index.ts:104-118` (handleGetPostgres inactivity reset)
- Modify: `api/rewards/index.ts:145-152` (handleGetAirtable inactivity reset)

**Step 1: Change reset behavior**

In both handlers, change the inactivity reset to ONLY reset streak fields:
```typescript
// Before: resets bonusPoints, currentStreak, longestStreak, badges, level, all scores
// After: only reset currentStreak
await updateUserRewardFields({
  userId,
  currentStreak: 0,
  // Keep everything else unchanged
  bonusPoints: user.bonusPoints,
  longestStreak: user.longestStreak,
  lastActiveDate: user.lastActiveDate,
  badges: existingBadges,
  level: user.level
})
```

Keep the `inactivityWarning` response field so the UI can show "welcome back" messaging.

**Step 2: Remove scoreReset flag from response**

The `scoreReset: true` response should change to `streakReset: true` since only the streak resets.

**Step 3: Update frontend type**

In `src/types/rewards.ts`, change `scoreReset?: boolean` to `streakReset?: boolean`.

**Step 4: Update any UI that references scoreReset**

Search for `scoreReset` in `src/` and update to `streakReset`.

**Step 5: Commit**
```bash
git add api/rewards/index.ts src/types/rewards.ts src/
git commit -m "feat: replace 90-day score wipe with streak-only reset"
```

---

## Task 9: Frontend Method Usage Rewards Invalidation

**Files:**
- Modify: `src/hooks/queries.ts` (useRecordMethodUsage)

**Step 1: Add rewards invalidation to method usage mutation**

Find `useRecordMethodUsage` and add to `onSuccess`:
```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.rewards })
```

**Step 2: Add optimistic rewards update**

Add `onMutate` handler that optimistically increments `mentalFitnessScore` and `totalPoints`. Since method points are variable, use the method's `pointsValue` from the mutation variables or default to 5.

**Step 3: Add rollback in onError**

Same pattern as `useCompletePersonalGoal` — snapshot previous rewards, restore on error.

**Step 4: Commit**
```bash
git add src/hooks/queries.ts
git commit -m "feat: add rewards invalidation and optimistic update to method usage"
```

---

## Task 10: DB Migration for User Metadata Columns

**Files:**
- Create: `tasks/db/migrations/018_user_metadata_rewards.sql`

**Step 1: Write migration**

```sql
-- Add first_active_date for time-based badges
ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS first_active_date TIMESTAMPTZ;

-- Backfill first_active_date from earliest method usage
UPDATE users_pg u
SET first_active_date = sub.earliest
FROM (
  SELECT user_id, MIN(used_at) as earliest
  FROM method_usage_pg
  GROUP BY user_id
) sub
WHERE u.id = sub.user_id AND u.first_active_date IS NULL;
```

**Step 2: Run migration**

```bash
npm run db:migrate
```

**Step 3: Commit**
```bash
git add tasks/db/migrations/018_user_metadata_rewards.sql
git commit -m "feat: add first_active_date column to users_pg"
```

---

## Task 11: Backfill Existing User Scores

**Files:**
- Create: `scripts/backfill-rewards-v2.ts`

**Step 1: Write backfill script**

Script that for each user:
1. Recalculates `mentalFitnessScore` using actual method `pointsValue` sums
2. Recalculates `personalGoalsScore` and `goodHabitsScore` from counts
3. Recalculates `totalPoints` from the new formulas
4. Recalculates `level` from new thresholds
5. Resets `currentStreak` to 0 (new program-aligned model)
6. Preserves `longestStreak`, `badges`, `bonusPoints`
7. Checks and awards any new badges the user qualifies for

**Step 2: Test on single user**

```bash
npx tsx scripts/backfill-rewards-v2.ts --dry-run --user-id=<test-user-id>
```

**Step 3: Run full backfill**

```bash
npx tsx scripts/backfill-rewards-v2.ts
```

**Step 4: Commit**
```bash
git add scripts/backfill-rewards-v2.ts
git commit -m "feat: backfill script for rewards v2 recalculation"
```

---

## Task 12: Build, Lint, Test, Final Verification

**Step 1: Run lint**
```bash
npx eslint . --max-warnings 0
```

**Step 2: Run type check**
```bash
npx tsc --noEmit
```

**Step 3: Run build**
```bash
npm run build
```

**Step 4: Run existing tests**
```bash
npx vitest run
```

**Step 5: Manual verification checklist**
- [ ] Complete a method → Mental Fitness score increases by method's pointsValue
- [ ] Complete a personal goal → Pers. Doelen score increases by 5
- [ ] Log a habit → Gewoontes score increases by 5
- [ ] Complete an overtuiging → total score increases by 1
- [ ] Score widgets update instantly (optimistic)
- [ ] New badge triggers show correct badges
- [ ] Level progression uses new thresholds
- [ ] Streak shows program-aligned count, not daily
- [ ] After inactivity: streak resets, scores stay

**Step 6: Final commit**
```bash
git commit -m "feat: rewards system v2 - complete implementation"
```
