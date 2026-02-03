# Current Behavior: Method Usage Points System

## System Architecture

### Data Flow

```
User completes media (97%+)
  ↓
FeedbackModal opens
  ↓
useEffect triggers (showFeedback = true)
  ↓
usageRegisteredRef checked (prevent duplicate in same session)
  ↓
POST /api/method-usage (create record)
  ↓
POST /api/rewards/award (award points)
  ↓
Airtable formula recalculates totalPoints
  ↓
UI updates (RewardToast shown)
```

### Frontend Implementation

**File**: `/src/pages/MethodDetailPage.tsx`

#### Duplicate Prevention (Session-Level)

```typescript
// Line 151: Ref to track if usage was already registered
const usageRegisteredRef = useRef(false)

// Lines 173-245: Register usage when feedback modal opens
useEffect(() => {
  if (!showFeedback || usageRegisteredRef.current) return
  if (!user?.id || !method?.id || !accessToken) return

  const registerUsage = async () => {
    usageRegisteredRef.current = true  // Prevent duplicate registration

    // Create method usage record
    await api.methodUsage.create({
      userId: user.id,
      methodId: method.id,
      programmaplanningId: programmaplanningId || undefined,
      programId: !programmaplanningId ? programId || undefined
    }, accessToken)

    // Award points
    await awardPointsMutation.mutateAsync({
      data: { activityType: "method", activityId: method.id },
      accessToken
    })
  }

  registerUsage()
}, [showFeedback, user?.id, method?.id, accessToken, programmaplanningId, programId])
```

**Key Behaviors**:
1. Usage is registered when feedback modal opens (not when user clicks save/skip)
2. `usageRegisteredRef` prevents duplicate registration within **same page session**
3. If user navigates away and comes back to same method → new session → new registration possible
4. If user closes modal and reopens (without navigation) → ref prevents duplicate
5. If error occurs during registration → ref is reset (line 240) for retry

#### Current Deduplication Scope

**Prevents**:
- Double registration if `registerUsage()` is called twice in same render cycle
- Re-registration if user closes and reopens feedback modal without leaving page
- Race conditions from React strict mode double-renders

**Does NOT Prevent**:
- Same method completed multiple times across different page visits
- Same method completed on different days
- Same method completed in different programs
- Multiple users completing same method

### Backend Implementation

**File**: `/api/method-usage/index.ts`

```typescript
// Lines 20-73: POST /api/method-usage
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Verify authentication
  const payload = await verifyToken(token)

  // 2. Parse request body
  const body = createUsageSchema.parse(rawBody)
  // {
  //   userId: string,
  //   methodId: string,
  //   programmaplanningId?: string,
  //   programId?: string (deprecated),
  //   remark?: string
  // }

  // 3. Create record in Airtable (no duplicate checking)
  const fields = {
    [METHOD_USAGE_FIELDS.user]: [body.userId],
    [METHOD_USAGE_FIELDS.method]: [body.methodId],
    [METHOD_USAGE_FIELDS.usedAt]: new Date().toISOString().split("T")[0]
  }

  if (body.programmaplanningId) {
    fields[METHOD_USAGE_FIELDS.programmaplanning] = [body.programmaplanningId]
  }

  // 4. Create record - ALWAYS succeeds (no validation)
  const record = await base(tables.methodUsage).create(fields)

  return sendSuccess(res, usage, 201)
}
```

**Key Behaviors**:
1. **No duplicate detection** - Every request creates a new record
2. Trusts frontend to prevent duplicates via `usageRegisteredRef`
3. Records today's date as `usedAt`
4. Links to `Programmaplanning` if provided (otherwise falls back to `Program`)

### Points Calculation

**File**: `/api/_lib/field-mappings.js` (Line 69)

```javascript
// Airtable Formula Field
totalPoints: "fldRcrVTHrvSUe1Mh"  // Totaal Punten (Formula - calculated)
```

**Airtable Formula** (configured in Airtable UI):
```
(5 × count(Gewoontegebruik)) + (10 × count(Methodegebruik)) + {Bonus Punten}
```

Where:
- `Gewoontegebruik`: Linked records in Habit Usage table
- `Methodegebruik`: Linked records in Method Usage table
- `Bonus Punten`: Number field for milestones/streaks (updated by API)

**Key Behaviors**:
1. Formula counts **all linked `method_usage` records** for user
2. Each record = +10 points (no deduplication in formula)
3. Same method completed 5 times = 5 records = 50 points
4. Formula recalculates automatically when new records are linked
5. Formula is read-only - cannot be modified by API

**File**: `/api/rewards/award.ts`

```typescript
// Lines 177-186: Comment explains current approach
// Calculate bonus points to award (only for milestones - habits/methods are counted by Airtable formula)
// The Airtable formula calculates: (5 × habit usage count) + (10 × method usage count) + {Bonus Punten}
let bonusPointsAwarded = 0
if (body.activityType === "programMilestone" && body.milestone) {
  bonusPointsAwarded = MILESTONE_POINTS[body.milestone] || 0
}
// Note: method and habit points are automatically counted by the Airtable formula
// We only track bonusPoints (milestones, streaks) separately
```

**Key Behaviors**:
1. API does **not** add 10 points directly for method completion
2. API only updates `bonusPoints` field for milestones/streaks
3. Actual method points come from formula counting `method_usage` records
4. Award endpoint returns `pointsAwarded` for UI feedback (shows bonus points only)

## Database Schema

### Users Table (Gebruikers)

| Field | Field ID | Type | Description |
|-------|----------|------|-------------|
| Totaal Punten | `fldRcrVTHrvSUe1Mh` | Formula | `(5 × habits) + (10 × methods) + bonusPoints` |
| Bonus Punten | `fldnTqsjBrzV37WPG` | Number | Milestones, streaks |
| Mental Fitness Score | `fldMTUjMC2vcY0HWA` | Formula | `# methodes * 10 + bonusPoints` |

### Method Usage Table (Methodegebruik - tblktNOXF3yPPavXU)

| Field | Field ID | Type | Description |
|-------|----------|------|-------------|
| Gebruiker | `fldlJtJOwZ4poOcoN` | Link | Link to Users (bidirectional) |
| Methode | `fldPyWglLXgXVO0ru` | Link | Link to Methods |
| Programmaplanning | `fldVyFTiTqVZ3BVoH` | Link | Link to scheduled session |
| Mentale Fitnessprogramma's | `fld18WcaPR8nXNr4a` | Link | DEPRECATED - use Programmaplanning |
| Gebruikt op | `fldvUGcgnwuux1bvi` | Date | Date completed (YYYY-MM-DD) |
| Opmerking | `fldpskQnKFWDFGRFk` | Long Text | User feedback |

**Current Records Example**:

```
Record 1:
  Gebruiker: [recUser123]
  Methode: [recBreathingExercise]
  Programmaplanning: [recPlanning001]
  Gebruikt op: "2026-02-03"

Record 2 (duplicate same day):
  Gebruiker: [recUser123]
  Methode: [recBreathingExercise]  // Same method!
  Programmaplanning: [recPlanning002]  // Different session
  Gebruikt op: "2026-02-03"  // Same day

→ Both records exist
→ Formula counts both
→ User gets 20 points (2 × 10)
```

## Current Edge Cases

### Edge Case 1: Multiple Completions Same Day

**Scenario**: User completes "Breathing Exercise" at 10 AM and 3 PM (no program context)

**Current Behavior**:
1. First completion (10 AM):
   - Creates `method_usage` record A
   - Points: +10 (formula counts 1 record)
2. Second completion (3 PM):
   - New page session (ref reset)
   - Creates `method_usage` record B
   - Points: +10 (formula now counts 2 records)
3. **Result**: 20 points total

**Data**:
```
Records in Methodegebruik:
- recA: User123 + BreathingExercise + 2026-02-03
- recB: User123 + BreathingExercise + 2026-02-03
```

### Edge Case 2: Same Method, Different Programs

**Scenario**: User completes "Breathing Exercise" in Program A and Program B

**Current Behavior**:
1. Completion in Program A:
   - Creates record linked to `programmaplanning` from Program A
   - Points: +10
2. Completion in Program B:
   - Creates record linked to `programmaplanning` from Program B
   - Points: +10
3. **Result**: 20 points total (legitimate - different programs)

### Edge Case 3: Reopening Feedback Modal

**Scenario**: User completes media, modal opens, user closes modal without submitting

**Current Behavior**:
1. Media completes → `setShowFeedback(true)`
2. `useEffect` triggers → `usageRegisteredRef.current = true` → Usage registered
3. User closes modal → `setShowFeedback(false)`
4. User completes media again (or page still open)
5. Modal reopens → `setShowFeedback(true)`
6. `useEffect` checks ref → `usageRegisteredRef.current` is still true → No duplicate
7. **Result**: Only 1 usage recorded ✓

### Edge Case 4: API Error During Registration

**Scenario**: Network error while creating method usage record

**Current Behavior**:
1. Media completes → Modal opens → `usageRegisteredRef.current = true`
2. API call fails (network error)
3. `catch` block (line 237): Sets `usageRegisteredRef.current = false`
4. User can retry by closing and reopening modal
5. **Result**: Ref reset allows retry ✓

### Edge Case 5: Same Session, Multiple Methods

**Scenario**: Programmaplanning session has 3 methods, user completes all

**Current Behavior**:
1. Complete Method A:
   - Creates record: `User + MethodA + ProgrammaplanningX`
   - Points: +10
2. Complete Method B:
   - Creates record: `User + MethodB + ProgrammaplanningX`
   - Points: +10
3. Complete Method C:
   - Creates record: `User + MethodC + ProgrammaplanningX`
   - Points: +10
4. **Result**: 30 points total (3 methods × 10) ✓

### Edge Case 6: User Navigates Back to Same Method

**Scenario**: User completes method → navigates away → navigates back to same method

**Current Behavior**:
1. First visit: Completes media → Usage registered → `usageRegisteredRef = true`
2. Navigate to homepage
3. Navigate back to same method → **New page mount** → `usageRegisteredRef = false` (new ref instance)
4. Complete media again → Usage registered again
5. **Result**: Duplicate record created, +10 more points

**Root Cause**: React ref is instance-based, resets on component unmount/remount

## Summary of Deduplication

| Scenario | Prevented? | Mechanism |
|----------|------------|-----------|
| Same modal opened twice (same session) | ✓ Yes | `usageRegisteredRef` |
| Same method, same day, different page visit | ✗ No | Ref resets on unmount |
| Same method, different days | ✗ No | No date-based checking |
| Same method, different programs | ✗ No | Legitimate separate completions |
| API call failure retry | ✓ Yes | Ref reset in catch block |
| Multiple methods in session | ✓ Yes | Each method is unique |

## Data Integrity Concerns

### Potential Issues

1. **Accidental Duplicates**: User refreshes page mid-completion → could register twice
2. **Gaming**: User could intentionally repeat quick methods for points
3. **Historical Data**: Existing data may already have duplicates
4. **No Audit Trail**: Can't distinguish intentional re-practice from accidental duplicates

### Current Safeguards

1. ✓ Session-level ref prevents immediate duplicates
2. ✓ Auth token required (can't spam without login)
3. ✗ No database constraints (Airtable allows duplicate records)
4. ✗ No rate limiting on method usage creation
5. ✗ No validation against existing records before creation

## Performance Characteristics

- **Frontend**: Lightweight ref-based tracking (no state, no re-renders)
- **Backend**: No duplicate detection queries (fast but allows duplicates)
- **Formula Calculation**: Airtable handles automatically (no performance impact on API)
- **Scale**: Works for current user base; might need optimization at 10,000+ users

## Recommendations for Investigation

1. Query Airtable for actual duplicate records:
   ```sql
   SELECT Gebruiker, Methode, "Gebruikt op", COUNT(*)
   GROUP BY Gebruiker, Methode, "Gebruikt op"
   HAVING COUNT(*) > 1
   ```

2. Analyze if duplicates are:
   - Same day, same method → Likely accidental
   - Different days, same method → Likely legitimate practice
   - Different Programmaplanning → Likely legitimate (different sessions)

3. Measure impact:
   - What % of total method_usage records are duplicates?
   - How many users have >2 completions of same method on same day?
   - Does this correlate with users who appear to be gaming the system?

## Related Documentation

- Frontend media tracking: `/src/hooks/useMediaProgress.tsx`
- API authentication: `/api/_lib/jwt.js`
- Airtable schema: `/api/_lib/field-mappings.js`
- Points awards: `/api/rewards/award.ts`
