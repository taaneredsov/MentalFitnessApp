# Reward System Implementation Review (2026-02-13)

## Scope

Review current rewards and badges behavior in backend + frontend to verify whether the feature is functionally complete.

## Summary

The reward UI is present and points/streak values are shown, but the badge and reward awarding logic is only partially functional. The main gap is that badge unlock checks depend on client-supplied counters that are usually not sent, so several badges never unlock in normal usage.

## What Works Today

- Rewards can be fetched and shown in UI (`api/rewards/index.ts`, `src/hooks/queries.ts`, `src/pages/AccountPage.tsx`).
- Method completion triggers reward awarding and reward toast (`src/pages/MethodDetailPage.tsx`).
- Habit/personal goal/overtuiging usage updates reward-relevant data and invalidates rewards queries (`api/habit-usage/index.ts`, `api/personal-goal-usage/index.ts`, `api/overtuiging-usage/index.ts`, `src/hooks/queries.ts`).
- Streak utility behavior has unit test coverage (`api/_lib/repos/__tests__/streak-utils.test.ts`).

## Findings (Ordered by Severity)

### 1) Badge unlock logic depends on optional request-body stats that are usually missing

- `api/rewards/award.ts` builds badge-check stats from optional request fields and defaults missing values to `0` (`methodsCompleted`, `habitsCompleted`, `programsCompleted`, etc.).
- Current callers do not provide those counters:
  - Method flow sends only `activityType` and `activityId` (`src/pages/MethodDetailPage.tsx`).
  - Habit, personal goal, and overtuiging flows do not call `/api/rewards/award` at all (`src/components/GoodHabitsSection.tsx`, `src/components/PersonalGoalsSection.tsx`, `src/components/OvertuigingenSection.tsx`).
- Impact: progress and habit badges are effectively blocked or unreliable for real users.

### 2) `eerste_programma` badge is effectively unreachable

- Badge rule checks `programsCompleted >= 1` (`api/rewards/award.ts`).
- No caller sends `programsCompleted`, and no dedicated program-complete award path is used in frontend.
- `checkProgramMilestones` can return `100`, but `eerste_programma` is not unlocked from milestone threshold directly.

### 3) Reward write path is Airtable-only, while read paths support backend mode switching

- `api/rewards/index.ts` supports backend mode (`airtable_only`, `postgres_shadow_read`, `postgres_primary`).
- `api/rewards/award.ts` always reads/writes Airtable directly.
- Impact in `postgres_primary`: reward writes bypass Postgres-first flow and can drift from other reward updates that go through repos/outbox.

### 4) Multiple reward update pathways create inconsistent behavior

- Method completion depends on `/api/rewards/award` for streak and bonus updates (`src/pages/MethodDetailPage.tsx`).
- Habit/personal goal/overtuiging endpoints update streak and bonus directly in their own handlers (`api/habit-usage/index.ts`, `api/personal-goal-usage/index.ts`, `api/overtuiging-usage/index.ts`).
- Impact: reward rules are fragmented and harder to keep consistent.

### 5) Date handling is inconsistent (UTC vs local), which risks streak errors around day boundaries

- `api/rewards/award.ts` uses UTC date via `toISOString().split("T")[0]`.
- Frontend habit/goal/overtuiging flows use local date helper (`src/lib/rewards-utils.ts`).
- `api/rewards/index.ts` stale streak check parses `YYYY-MM-DD` and manipulates local hours, which can shift dates depending on timezone.
- Impact: off-by-one-day streak behavior is possible in edge timezones/hours.

### 6) Test coverage misses critical reward API behavior

- No dedicated tests for `api/rewards/index.ts` or `api/rewards/award.ts`.
- Existing reward-adjacent tests cover hooks and repo helpers, not badge eligibility logic or backend-mode behavior.

## Spec Drift (Current plan vs reality)

- `specs/reward-system/implementation-plan.md` states Good Habits should call reward API after habit usage, but current implementation does not do that.
- Plan implies broad activity-type support in `/api/rewards/award`, but production callers only use `"method"` and `"programMilestone"`.

## Recommended Remediation Plan

1. Unify reward awarding server-side:
   - Create one reward engine function that computes points, streak, badges, level from persisted data.
   - Call it from all activity endpoints (method, habit, personal goal, overtuiging, program milestones).

2. Stop trusting client-provided badge counters:
   - Derive counters in backend from repo/DB/Airtable counts.
   - Keep request payload minimal (`activityType`, entity IDs, date).

3. Add backend-mode support to reward awarding:
   - Add `postgres_primary` path to `api/rewards/award.ts` (or move to repos/service layer).
   - Keep Airtable path for `airtable_only`.

4. Normalize date model:
   - Use a single canonical activity date source (prefer explicit date from caller in local timezone context).
   - Avoid `new Date("YYYY-MM-DD")` timezone pitfalls for streak math.

5. Add tests before refactor completion:
   - Badge unlock integration tests.
   - Streak edge-case tests around timezone/day changes.
   - Backend-mode parity tests (Airtable vs Postgres paths).

