# Requirements: Method Usage Points System

## Overview

Document the points system for method completion and clarify the intended behavior for duplicate method usage within the same program or session.

## Current Understanding

### Points Calculation

Points are calculated in Airtable using a formula:

```
Totaal Punten (Total Points) = (5 × habit usage count) + (10 × method usage count) + Bonus Punten
```

Where:
- **Method usage count**: Number of records in `Methodegebruik` (Method Usage) table linked to the user
- **Habit usage count**: Number of records in `Gewoontegebruik` (Habit Usage) table linked to the user
- **Bonus Punten**: Manually awarded bonus points (e.g., milestones, streaks)

### Method Completion Flow

1. User completes media playback (reaches 97%+ of duration or pauses near end)
2. Feedback modal opens automatically
3. Method usage is registered **when the modal opens** (not on save/skip)
4. API call creates new record in `Methodegebruik` table
5. Points are awarded via `/api/rewards/award` endpoint (10 points for method completion)
6. Total points formula automatically recalculates in Airtable

### Points per Activity Type

From `/api/rewards/award.ts`:

```typescript
const POINTS = {
  method: 10,                  // Completing a method
  sessionBonus: 5,             // Completing all methods in a session
  habit: 5,                    // Completing a habit
  habitDayBonus: 5,            // Completing all habits for the day
  streakWeek: 50,              // 7-day streak milestone
  streakMonth: 200,            // 30-day streak milestone
  program: 100,                // Completing an entire program
  milestone25: 25,             // 25% program progress
  milestone50: 50,             // 50% program progress
  milestone75: 75,             // 75% program progress
  milestone100: 100            // 100% program completion
}
```

**Note**: Method and habit points (10 and 5 respectively) are counted automatically by the Airtable formula. The API only updates `bonusPoints` for milestones and streaks.

## Key Questions

### 1. Same Method, Multiple Completions

**Current Behavior**:
- User completes "Breathing Exercise" → Creates `method_usage` record A → 10 points
- User completes "Breathing Exercise" again → Creates `method_usage` record B → Another 10 points
- Total: 20 points from 2 usage records

**Questions**:
- Is this the intended behavior?
- Should users get points every time they practice the same method?
- Or should each unique method only count once per program?

### 2. Time-Based Deduplication

**Option A: Same-Day Deduplication**
- First completion of "Breathing Exercise" on Monday → 10 points
- Second completion of "Breathing Exercise" on Monday → 0 points (duplicate)
- Completion of "Breathing Exercise" on Tuesday → 10 points (new day)

**Option B: Same-Session Deduplication**
- Within a single page session (tracked by `usageRegisteredRef`), prevent duplicates
- Currently implemented: prevents duplicate API calls if user refreshes/reopens modal
- Across sessions: allows new points

**Option C: Program-Level Deduplication**
- Each method within a program counts once
- Completing "Breathing Exercise" in Program A → 10 points
- Completing same method again in Program A → 0 points
- Completing same method in Program B → 10 points (different program)

**Option D: No Deduplication (Current)**
- Every completion counts
- Encourages repeated practice
- Risk: Gaming the system by repeating quick methods

### 3. Programmaplanning Context

The system links method usage to specific scheduled sessions (`Programmaplanning`):

```typescript
// When user completes a method from program schedule
{
  userId: "recXXX",
  methodId: "recYYY",
  programmaplanningId: "recZZZ",  // Links to specific scheduled day
  usedAt: "2026-02-03"
}
```

**Question**: Should deduplication consider the `Programmaplanning` context?
- Same method, same scheduled session → 1 point
- Same method, different scheduled session → Multiple points

## Product Owner Decisions Needed

### Decision 1: Repeated Method Practice

Choose one:
- [ ] **A. Reward Every Practice** - Each completion of any method awards points (current behavior)
- [ ] **B. Daily Unique Methods** - Only first completion of each method per day awards points
- [ ] **C. Program Unique Methods** - Only first completion of each method within a program awards points
- [ ] **D. Session-Based** - Points only awarded per scheduled Programmaplanning session

### Decision 2: Edge Cases

**Scenario**: User completes "Breathing Exercise" at 10:00 AM and again at 3:00 PM (same day, no program context)

Choose one:
- [ ] Both award 10 points (20 total)
- [ ] Only first awards 10 points (10 total)
- [ ] Second awards reduced points (e.g., 5 points)

**Scenario**: User completes the same method in two different scheduled sessions on the same day

Choose one:
- [ ] Both award 10 points (each session is distinct)
- [ ] Only first awards 10 points (same day, same method)
- [ ] Depends on whether sessions have different goals

### Decision 3: Formula vs. Application Logic

Currently, points are calculated by an Airtable formula that counts ALL `method_usage` records:

```
(5 × habit usage count) + (10 × method usage count) + Bonus Punten
```

To implement deduplication, choose one:

- [ ] **A. Keep Formula, Add Business Logic** - Prevent creating duplicate `method_usage` records in API
- [ ] **B. Keep Formula, Add Filtering** - Count only distinct `(userId, methodId, date)` tuples in formula
- [ ] **C. Move to Application** - Remove formula, calculate points entirely in API code
- [ ] **D. Hybrid** - Keep formula for base points, use API bonuses for special cases

## Recommended Approach (Draft)

Based on typical gamification patterns, I recommend:

### Option: Session-Based Points with Daily Bonus

1. **Base Rule**: Award 10 points per `Programmaplanning` session completion
   - Each scheduled session can be completed once
   - Multiple methods in same session = 10 points each
   - Same method in different sessions = 10 points each

2. **Daily Deduplication**: Same method completed multiple times in the same day (outside scheduled sessions) counts once
   - First completion → 10 points
   - Subsequent completions same day → 0 points
   - Encourages variety over repetition

3. **Practice Bonus**: Reward daily practice regardless of method
   - Complete any 3+ unique methods in a day → 20 bonus points
   - Incentivizes exploration of different techniques

4. **Implementation**:
   - Keep Airtable formula as-is
   - Add API validation before creating `method_usage` record
   - Check for existing `(userId, methodId, date)` record before creating new one

### Why This Approach?

- **Clear boundaries**: Scheduled sessions are natural completion units
- **Prevents gaming**: Can't spam same quick method
- **Encourages variety**: Daily unique methods get full points
- **Maintains current data**: Formula still counts records
- **Simple to explain**: "Each scheduled practice session counts once"

## Acceptance Criteria (To Be Defined)

Once decisions are made, define:

- [ ] Exact deduplication logic
- [ ] Error messages when duplicate detected
- [ ] UI feedback for users (e.g., "Already completed today")
- [ ] Historical data handling (retroactive deduplication?)
- [ ] Testing scenarios for edge cases

## Related Files

- Frontend: `/src/pages/MethodDetailPage.tsx` (lines 150-245)
- Backend: `/api/method-usage/index.ts`
- Points Logic: `/api/rewards/award.ts`
- Field Mappings: `/api/_lib/field-mappings.js` (line 69: totalPoints formula)

## Next Steps

1. Product owner reviews this document
2. Makes decisions on questions above
3. Document chosen approach in `implementation-plan.md`
4. Update acceptance criteria based on decisions
