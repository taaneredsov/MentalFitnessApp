# Implementation Plan: Method Usage Points System

> **Status**: AWAITING PRODUCT OWNER DECISION
>
> This document outlines implementation options based on different product decisions. The actual implementation plan will be finalized after product owner reviews `requirements.md` and makes decisions.

## Prerequisites

Before implementing any changes:

1. **Analyze Existing Data**
   ```sql
   -- Find duplicate method usage records (same user, method, date)
   SELECT
     Gebruiker,
     Methode,
     "Gebruikt op",
     COUNT(*) as count
   FROM Methodegebruik
   GROUP BY Gebruiker, Methode, "Gebruikt op"
   HAVING COUNT(*) > 1
   ORDER BY count DESC
   ```

2. **Measure Impact**
   - How many users have duplicate records?
   - What % of total points come from potential duplicates?
   - Are duplicates legitimate re-practice or gaming?

3. **Product Decision**
   - Review `requirements.md` with product owner
   - Choose deduplication approach
   - Define acceptance criteria
   - Decide on historical data handling

## Option A: No Changes (Current Behavior)

**Decision**: Every method completion awards points, including repeated practice.

### Rationale
- Encourages daily practice and repetition
- Simple system, already working
- Rewards effort rather than just variety
- No development cost

### Implementation
- No code changes required
- Document current behavior as intended
- Add user-facing explanation: "Practice makes perfect! Earn 10 points every time you complete a method."

### Risks
- Users could game system by repeating short methods
- Doesn't encourage trying new methods
- Difficult to distinguish accidental duplicates from intentional practice

---

## Option B: Daily Unique Method Deduplication

**Decision**: Only first completion of each method per day awards points.

### User Impact
- ✅ Encourages exploring different methods daily
- ✅ Prevents accidental duplicates from awarding extra points
- ❌ Repeated practice doesn't feel rewarded
- ❌ Advanced users who practice 2x daily may feel penalized

### Technical Approach

#### Backend Validation (Recommended)

**File**: `/api/method-usage/index.ts`

```typescript
// Add before creating record
const today = new Date().toISOString().split("T")[0]

// Check for existing usage today
const existingRecords = await base(tables.methodUsage)
  .select({
    filterByFormula: `AND(
      {Gebruiker} = "${escapeFormulaValue(body.userId)}",
      {Methode} = "${escapeFormulaValue(body.methodId)}",
      {Gebruikt op} = "${today}"
    )`,
    maxRecords: 1
  })
  .firstPage()

if (existingRecords.length > 0) {
  return sendError(res, "Methode al voltooid vandaag", 409)
}

// Proceed with record creation
```

**Frontend Handling**:

```typescript
// In MethodDetailPage.tsx, catch 409 error
try {
  await api.methodUsage.create(...)
} catch (err) {
  if (err.status === 409) {
    // Show friendly message
    toast.info("Je hebt deze methode vandaag al voltooid! Probeer een andere methode voor extra punten.")
    return
  }
  throw err
}
```

#### Frontend Prevention (Alternative)

Check before registration:

```typescript
// Fetch today's completed methods before registration
const todayCompletions = await api.methodUsage.getTodayByUser(user.id)
if (todayCompletions.some(c => c.methodId === method.id)) {
  // Show message, don't register usage
  return
}
```

**Pros**: Faster (no failed API call)
**Cons**: Race conditions possible, client can bypass

### Migration Strategy

**Historical Data**:

Option B1: Keep existing duplicates
- No retroactive changes
- Only prevent future duplicates
- Pro: Doesn't change user's current point totals
- Con: Historical data still has duplicates

Option B2: Deduplicate historical records
- Archive duplicate records (don't delete)
- Adjust user's bonus points to compensate for removed records
- Pro: Clean data going forward
- Con: Complex migration, could confuse users

### Testing Scenarios

1. User completes Method A at 10 AM → 10 points ✓
2. User completes Method A at 3 PM (same day) → 0 points, friendly message
3. User completes Method A next day → 10 points ✓
4. User completes Method B same day as Method A → 10 points ✓

---

## Option C: Session-Based Deduplication (Recommended)

**Decision**: Points awarded per unique `Programmaplanning` session completion. Same method can be completed multiple times if in different sessions.

### User Impact
- ✅ Clear boundary: Each scheduled session counts once
- ✅ Rewards completing full program schedule
- ✅ Doesn't penalize practicing same method in different contexts
- ✅ Natural deduplication (can't complete same session twice)
- ❌ Ad-hoc practice (no program context) needs separate handling

### Technical Approach

#### Deduplication Logic

```typescript
// In /api/method-usage/index.ts

// If programmaplanningId is provided, check for existing completion
if (body.programmaplanningId) {
  const existingRecords = await base(tables.methodUsage)
    .select({
      filterByFormula: `AND(
        {Gebruiker} = "${escapeFormulaValue(body.userId)}",
        {Methode} = "${escapeFormulaValue(body.methodId)}",
        {Programmaplanning} = "${escapeFormulaValue(body.programmaplanningId)}"
      )`,
      maxRecords: 1
    })
    .firstPage()

  if (existingRecords.length > 0) {
    return sendError(res, "Sessie al voltooid", 409)
  }
}

// For ad-hoc practice (no programmaplanningId), apply daily deduplication
else {
  const today = new Date().toISOString().split("T")[0]
  const existingRecords = await base(tables.methodUsage)
    .select({
      filterByFormula: `AND(
        {Gebruiker} = "${escapeFormulaValue(body.userId)}",
        {Methode} = "${escapeFormulaValue(body.methodId)}",
        {Gebruikt op} = "${today}",
        {Programmaplanning} = BLANK()
      )`,
      maxRecords: 1
    })
    .firstPage()

  if (existingRecords.length > 0) {
    return sendError(res, "Methode al voltooid vandaag (vrije oefening)", 409)
  }
}

// Proceed with creation
```

### UI Indicators

**Program Schedule View**:
```typescript
// Show completion status per session
<SessionCard>
  {session.isCompleted ? (
    <CheckCircle className="text-green-500" />
  ) : (
    <Circle className="text-gray-300" />
  )}
</SessionCard>
```

**Method Detail Page**:
```typescript
// Show if already completed in this session
{programmaplanningId && isAlreadyCompleted && (
  <Alert variant="info">
    Je hebt deze methode al voltooid voor deze sessie.
    Punten worden slechts één keer toegekend per sessie.
  </Alert>
)}
```

### Testing Scenarios

1. Complete Method A in Program 1, Session 1 → 10 points ✓
2. Try to complete Method A in Program 1, Session 1 again → 0 points, error message
3. Complete Method A in Program 1, Session 2 → 10 points ✓
4. Complete Method A ad-hoc (no program) → 10 points ✓
5. Complete Method A ad-hoc again same day → 0 points, error message
6. Complete Method A ad-hoc next day → 10 points ✓

---

## Option D: Formula-Based Deduplication

**Decision**: Change Airtable formula to count only unique `(methodId, date)` combinations.

### Technical Approach

**Airtable Formula Change**:

Current:
```
(5 × COUNT({Gewoontegebruik})) + (10 × COUNT({Methodegebruik})) + {Bonus Punten}
```

Proposed (pseudocode - Airtable formula syntax may vary):
```
(5 × COUNT(UNIQUE({Gewoontegebruik}, {Datum})))
+ (10 × COUNT(UNIQUE({Methodegebruik}, {Gebruikt op})))
+ {Bonus Punten}
```

**Challenges**:
- Airtable formulas cannot directly count unique combinations
- Would require rollup fields or complex formula tricks
- May hit formula complexity limits
- Difficult to debug and maintain

**Alternative**: Use API to count unique records

```typescript
// In /api/rewards/index.ts
export function transformUserRewards(record) {
  const fields = record.fields

  // Fetch linked method usage records
  const methodUsageRecords = fields[USER_FIELDS.methodUsage] || []

  // Deduplicate by (methodId, date)
  const uniqueCompletions = new Map()
  for (const usageRecord of methodUsageRecords) {
    const key = `${usageRecord.methodId}-${usageRecord.usedAt}`
    if (!uniqueCompletions.has(key)) {
      uniqueCompletions.set(key, usageRecord)
    }
  }

  const uniqueMethodCount = uniqueCompletions.size
  const calculatedPoints = (uniqueMethodCount * 10) + fields[USER_FIELDS.bonusPoints]

  return {
    totalPoints: calculatedPoints,  // Calculated in API, not formula
    bonusPoints: fields[USER_FIELDS.bonusPoints],
    // ... rest
  }
}
```

**Pros**:
- Full control over deduplication logic
- Can apply complex rules
- Easy to change logic without Airtable changes

**Cons**:
- Moves calculation from Airtable (single source of truth) to API
- Requires fetching all linked records (performance impact)
- totalPoints field becomes stale (shows old formula value)
- Need to migrate field from Formula to Number type

### Recommendation: ❌ Not Recommended

This approach is more complex and fragile than backend validation (Option C).

---

## Recommended Implementation: Option C

### Phase 1: Add Backend Validation (Week 1)

**Tasks**:
1. Update `/api/method-usage/index.ts` with deduplication logic
2. Add error responses (409 Conflict) for duplicates
3. Update frontend to handle 409 errors gracefully
4. Add toast notifications for duplicate attempts
5. Write API tests for deduplication edge cases

**Files to Change**:
- `/api/method-usage/index.ts` (add duplicate check)
- `/src/pages/MethodDetailPage.tsx` (handle 409 errors)
- `/src/lib/api-client.ts` (error handling)

### Phase 2: Add UI Indicators (Week 1)

**Tasks**:
1. Check if method already completed before opening feedback modal
2. Show completion badge on already-completed sessions
3. Add "Already completed" message in method detail page
4. Update program schedule to show completion status

**Files to Change**:
- `/src/pages/MethodDetailPage.tsx` (pre-check completion)
- `/src/hooks/queries.ts` (add query for checking completion)
- Schedule/calendar components (add completion indicators)

### Phase 3: Data Analysis & Cleanup (Week 2)

**Tasks**:
1. Query for duplicate records in production
2. Analyze patterns (accidental vs. intentional)
3. Decide on historical data handling
4. If needed, run migration to clean up duplicates

**Queries**:
```sql
-- Find duplicate session completions
SELECT
  Gebruiker,
  Methode,
  Programmaplanning,
  COUNT(*) as count
FROM Methodegebruik
WHERE Programmaplanning IS NOT NULL
GROUP BY Gebruiker, Methode, Programmaplanning
HAVING COUNT(*) > 1

-- Find duplicate daily completions (ad-hoc)
SELECT
  Gebruiker,
  Methode,
  "Gebruikt op",
  COUNT(*) as count
FROM Methodegebruik
WHERE Programmaplanning IS NULL
GROUP BY Gebruiker, Methode, "Gebruikt op"
HAVING COUNT(*) > 1
```

### Phase 4: Testing & Validation (Week 2)

**Test Cases**:

| Scenario | Expected Result |
|----------|----------------|
| Complete session method first time | ✓ 10 points, success message |
| Complete same session method again | ✗ 0 points, "Already completed" message |
| Complete same method in different session | ✓ 10 points, success message |
| Complete ad-hoc method first time today | ✓ 10 points, success message |
| Complete ad-hoc method again same day | ✗ 0 points, "Already completed today" message |
| Complete ad-hoc method next day | ✓ 10 points, success message |
| API error during check | Retry, show generic error |
| Network offline | Queue for retry when online |

### Phase 5: Documentation & Rollout (Week 3)

**Tasks**:
1. Update user-facing help text
2. Add FAQ entry explaining points system
3. Create changelog entry
4. Monitor error rates after deployment
5. Gather user feedback

**User Communication**:
```markdown
## Points System Update

We've improved how points are awarded for method completion:

- **Scheduled Sessions**: Each session in your program can be completed once for 10 points
- **Daily Practice**: Complete any method once per day for 10 points
- **Want More Points?** Try different methods each day to maximize your score!

Don't worry - your existing points are safe and won't change.
```

---

## Alternative Quick Wins (No Code Changes)

If product decides to keep current behavior but wants to encourage variety:

### 1. Add Daily Variety Bonus

**Formula Change**: None
**Backend Change**: Add bonus point logic

```typescript
// In /api/rewards/award.ts
// After method usage created, check unique methods completed today
const todayUsage = await fetchTodayMethodUsage(userId)
const uniqueMethodsToday = new Set(todayUsage.map(u => u.methodId))

if (uniqueMethodsToday.size >= 3) {
  // Award 20 bonus points for trying 3+ different methods today
  bonusPointsAwarded += 20
}
```

### 2. Add UI Nudge

Show message when user completes same method multiple times:

```typescript
{previousCompletionToday && (
  <Alert variant="info">
    Je hebt deze methode vandaag al voltooid!
    Probeer een nieuwe methode om je vaardigheden te verbreden.
  </Alert>
)}
```

### 3. Gamify Variety

Add badge for trying many unique methods:

```typescript
const BADGE_CHECKS = {
  // ... existing badges
  explorer: {
    check: (stats) => stats.uniqueMethodsCompleted >= 10,
    title: "Verkenner",
    description: "Probeer 10 verschillende methodes"
  }
}
```

---

## Decision Matrix

| Criteria | Option A (No Change) | Option B (Daily Unique) | Option C (Session-Based) | Option D (Formula) |
|----------|---------------------|------------------------|--------------------------|-------------------|
| Development Effort | ✅ None | 🟡 Medium | 🟡 Medium | 🔴 High |
| Data Integrity | 🔴 Allows duplicates | ✅ Clean data | ✅ Clean data | ✅ Clean data |
| User Experience | 🟡 May confuse | ✅ Clear rules | ✅ Intuitive | ✅ Automatic |
| Performance | ✅ Fast | 🟡 Extra query | 🟡 Extra query | 🔴 Slow (fetch all) |
| Encourages Variety | 🔴 No | ✅ Yes | 🟡 Partial | ✅ Yes |
| Rewards Practice | ✅ Yes | 🔴 No | ✅ Yes | 🔴 No |
| Gaming Prevention | 🔴 None | ✅ Strong | ✅ Strong | ✅ Strong |
| Maintainability | ✅ Simple | ✅ Clear logic | ✅ Clear logic | 🔴 Complex |

**Recommendation**: **Option C (Session-Based Deduplication)** provides the best balance of user experience, data integrity, and development effort.

---

## Next Steps

1. ✅ Product Owner reviews `requirements.md`
2. ⏸️ Product Owner chooses approach (A, B, C, or D)
3. ⏸️ Finalize acceptance criteria based on choice
4. ⏸️ Create technical tasks in project management tool
5. ⏸️ Assign to developer
6. ⏸️ Implement chosen option
7. ⏸️ Test thoroughly with scenarios above
8. ⏸️ Deploy and monitor

---

## Open Questions

1. Should historical duplicate records be cleaned up or left as-is?
2. What should error message say when duplicate detected? (User-friendly Dutch text)
3. Should we add analytics to track duplicate attempt frequency?
4. Do we want a "practice mode" that doesn't award points but allows unlimited repetition?
5. Should advanced users be able to disable deduplication for intensive practice days?
